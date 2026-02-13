import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
} from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { uIOhook } from "uiohook-napi";
import {
  normalizeTranscriptionLanguageSelection,
  VISIBLE_TRANSCRIPTION_LANGUAGES,
  type SelectableTranscriptionLanguage,
} from "../../types/languages";
import { AI_MODEL_OPTIONS } from "../../types/models";
import {
  getDefaultInputDeviceName,
  invalidateDefaultDeviceCache,
  listAudioDevices,
  startMicTest,
  type MicTestSession,
} from "./audio";
import { addAutoCorrectionToConvex, setUserId } from "./convexClient";
import { getDeviceId } from "./deviceId";
import {
  addDictionaryEntry,
  deleteDictionaryEntry,
  loadDictionary,
  syncDictionary,
  type DictionaryEntry,
} from "./dictionaryStore";
import {
  cancelTracking as cancelEditTracking,
  notifyKeystroke as editTrackerKeystroke,
  setOnCorrectionsDetected,
  startTracking as startEditTracking,
} from "./editTracker";
import { GhostingController } from "./ghosting";
import { registerGhostingHotkey } from "./hotkey";
import {
  getDefaultSettings,
  loadSettings,
  updateSettings,
  type GhostingShortcut,
  type GhostwriterSettings,
  type GhostwriterSettingsUpdate,
} from "./settings";
import { loadSnippets, syncSnippets, type SnippetEntry } from "./snippetStore";
import {
  deleteLocalTranscript,
  loadLocalTranscripts,
  saveLocalTranscript,
} from "./transcriptStore";
import {
  addVibeCodeFile,
  loadVibeCodeFiles,
  removeVibeCodeFile,
  type VibeCodeFile,
} from "./vibeCodeStore";
import { startWhisperServer, stopWhisperServer } from "./whisper";

function loadEnvFile() {
  const root = app.isPackaged ? process.resourcesPath : app.getAppPath();
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFile();

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let unregisterHotkey: (() => void) | null = null;
let isQuitting = false;
let trayIcons: {
  idle: Electron.NativeImage;
  recording: Electron.NativeImage;
} | null = null;
let settings: GhostwriterSettings | null = null;
let isAdmin = false;
let capturingShortcutTarget: "shortcut" | "toggleShortcut" | null = null;
let activeMicTest: MicTestSession | null = null;

function resolveRendererUrl() {
  const staticPath = path.join(app.getAppPath(), "out", "index.html");

  if (app.isPackaged || fs.existsSync(staticPath)) {
    return `file://${staticPath}`;
  }

  return "http://localhost:3000";
}

function resolveAppResourcePath(...segments: string[]) {
  const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(basePath, ...segments);
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1350,
    height: 850,
    minWidth: 1140,
    minHeight: 750,
    resizable: true,
    show: false,
    backgroundColor: "#ffffff",
    title: "GhostWriter",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    icon: resolveAppResourcePath("public/assets", "ghosty-dock.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });

  win.loadURL(resolveRendererUrl());

  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
}

const OVERLAY_WIDTH = 300;
const OVERLAY_HEIGHT = 120;

/** Resolve the display the overlay should live on, based on the user's setting. */
function getOverlayDisplay() {
  const displayId = settings?.overlayDisplayId ?? null;
  if (displayId !== null) {
    const match = screen.getAllDisplays().find((d) => d.id === displayId);
    if (match) return match;
  }
  // Fallback: primary display
  return screen.getPrimaryDisplay();
}

function createOverlayWindow() {
  const activeDisplay = getOverlayDisplay();
  const { x, y, width, height } = activeDisplay.workArea;

  const win = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: x + Math.round((width - OVERLAY_WIDTH) / 2),
    y: y + height - OVERLAY_HEIGHT,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    minimizable: false,
    closable: false,
    skipTaskbar: true,
    show: false,
    type: "panel",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "overlayPreload.js"),
    },
  });

  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Start with mouse events enabled — on macOS, transparent pixels are
  // naturally click-through so only the visible pill captures the mouse.
  // This lets the CSS cursor: pointer work immediately on hover.
  win.setIgnoreMouseEvents(false);

  // Prevent the overlay from ever being minimized or closed
  win.on("minimize", () => win.restore());
  win.on("close", (e) => e.preventDefault());

  const overlayPath = resolveAppResourcePath("resources", "overlay.html");
  win.loadFile(overlayPath);

  win.once("ready-to-show", () => {
    win.showInactive();
  });

  return win;
}

function repositionOverlay() {
  if (!overlayWindow) return;
  const activeDisplay = getOverlayDisplay();
  const { x, y, width, height } = activeDisplay.workArea;
  overlayWindow.setBounds({
    x: x + Math.round((width - OVERLAY_WIDTH) / 2),
    y: y + height - OVERLAY_HEIGHT,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
  });
}

function loadTrayIcon(name: string) {
  const iconPath = resolveAppResourcePath("public/assets", name);
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    return nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0n4dQAAAAASUVORK5CYII=",
    );
  }
  return icon.resize({ width: 18, height: 18 });
}

let cachedAudioDevices: { index: number; name: string }[] = [];
let cachedDisplays: { id: number; label: string }[] = [];

function createTray() {
  if (tray) {
    rebuildTrayMenu();
    return;
  }

  trayIcons = {
    idle: loadTrayIcon("ghosty.png"),
    recording: loadTrayIcon("ghosty-talking.png"),
  };

  tray = new Tray(trayIcons.idle);

  const toggleWindow = () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  tray.on("click", toggleWindow);
  tray.setToolTip("GhostWriter");

  // Cache audio devices and displays, then build menu
  cachedDisplays = screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: `Display ${i + 1} — ${d.size.width}×${d.size.height}`,
  }));

  listAudioDevices()
    .then((devices) => {
      cachedAudioDevices = devices;
      rebuildTrayMenu();
    })
    .catch(() => rebuildTrayMenu());
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

function applyTrayVisibility(showInTray: boolean) {
  if (showInTray) {
    createTray();
    return;
  }
  destroyTray();
}

function applyDockVisibility(showInDock: boolean) {
  if (!app.dock) return;
  if (showInDock) {
    app.dock.show();
  } else {
    app.dock.hide();
  }
}

function applyLoginItemSetting(openAtLogin: boolean) {
  app.setLoginItemSettings({ openAtLogin });
}

function applyAppVisibilitySettings(next: GhostwriterSettings) {
  applyDockVisibility(next.showInDock);
  applyTrayVisibility(next.showInTray);
  applyLoginItemSetting(next.openAtLogin);
}

function playGhostingTransitionSound(kind: "start" | "stop") {
  const soundFile = kind === "start" ? "click-start.wav" : "click-stop.wav";
  const soundPath = app.isPackaged
    ? path.join(process.resourcesPath, "sounds", soundFile)
    : resolveAppResourcePath("resources", "sounds", soundFile);
  execFile("afplay", [soundPath], (err) => {
    if (err) console.warn("Failed to play sound:", err.message);
  });
}

function rebuildTrayMenu() {
  if (!tray) return;

  const currentSettings = settings ?? getDefaultSettings();

  const toggleWindow = () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  const micSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: "System default (auto-detect)",
      type: "radio",
      checked: !currentSettings.selectedMicrophone,
      click: async () => {
        if (!settings) settings = await loadSettings();
        settings = await updateSettings(settings, {
          selectedMicrophone: null,
        });
        notifySettings(settings);
        rebuildTrayMenu();
      },
    },
    ...cachedAudioDevices.map(
      (device): Electron.MenuItemConstructorOptions => ({
        label: device.name,
        type: "radio",
        checked: currentSettings.selectedMicrophone === device.name,
        click: async () => {
          if (!settings) settings = await loadSettings();
          settings = await updateSettings(settings, {
            selectedMicrophone: device.name,
          });
          notifySettings(settings);
          rebuildTrayMenu();
        },
      }),
    ),
  ];

  const modelSubmenu: Electron.MenuItemConstructorOptions[] =
    AI_MODEL_OPTIONS.map((model) => ({
      label: model.label,
      type: "radio" as const,
      checked: currentSettings.aiModel === model.id,
      click: async () => {
        if (!settings) settings = await loadSettings();
        settings = await updateSettings(settings, { aiModel: model.id });
        notifySettings(settings);
        rebuildTrayMenu();
      },
    }));

  const languageSubmenu: Electron.MenuItemConstructorOptions[] = (() => {
    const selectedCodes = new Set<string>(
      currentSettings.transcriptionLanguages,
    );
    const allLanguages = VISIBLE_TRANSCRIPTION_LANGUAGES.filter(
      (l) => l.code !== "auto",
    );
    const selected = allLanguages.filter((l) => selectedCodes.has(l.code));
    const unselected = allLanguages.filter((l) => !selectedCodes.has(l.code));

    const makeItem = (
      language: (typeof allLanguages)[number],
    ): Electron.MenuItemConstructorOptions => ({
      label: `${language.flag}  ${language.label}`,
      type: "checkbox",
      checked: selectedCodes.has(language.code),
      click: async () => {
        if (!settings) settings = await loadSettings();
        const current = new Set<string>(settings.transcriptionLanguages);
        if (current.has(language.code)) {
          current.delete(language.code);
        } else {
          current.add(language.code);
        }
        // Ensure at least one language remains selected.
        if (current.size === 0) current.add(language.code);
        const nextLanguages = normalizeTranscriptionLanguageSelection([
          ...current,
        ]);
        const primaryLanguage: SelectableTranscriptionLanguage =
          nextLanguages[0] ?? ("en" as SelectableTranscriptionLanguage);
        settings = await updateSettings(settings, {
          transcriptionLanguage:
            nextLanguages.length > 1 ? "auto" : primaryLanguage,
          transcriptionLanguages: nextLanguages,
        });
        notifySettings(settings);
        rebuildTrayMenu();
      },
    });

    const items: Electron.MenuItemConstructorOptions[] = selected.map(makeItem);
    if (selected.length > 0 && unselected.length > 0) {
      items.push({ type: "separator" });
    }
    items.push(...unselected.map(makeItem));
    return items;
  })();

  const displaySubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Primary display",
      type: "radio",
      checked: !currentSettings.overlayDisplayId,
      click: async () => {
        if (!settings) settings = await loadSettings();
        settings = await updateSettings(settings, {
          overlayDisplayId: null,
        });
        notifySettings(settings);
        rebuildTrayMenu();
      },
    },
    ...cachedDisplays.map(
      (display): Electron.MenuItemConstructorOptions => ({
        label: display.label,
        type: "radio",
        checked: currentSettings.overlayDisplayId === display.id,
        click: async () => {
          if (!settings) settings = await loadSettings();
          settings = await updateSettings(settings, {
            overlayDisplayId: display.id,
          });
          notifySettings(settings);
          rebuildTrayMenu();
        },
      }),
    ),
  ];

  const menu = Menu.buildFromTemplate([
    { label: "Open GhostWriter", click: toggleWindow },
    { type: "separator" },
    { label: "Microphone", submenu: micSubmenu },
    { label: "Languages", submenu: languageSubmenu },
    ...(isAdmin ? [{ label: "AI Model", submenu: modelSubmenu }] : []),
    ...(cachedDisplays.length > 1
      ? [{ label: "Display", submenu: displaySubmenu }]
      : []),
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function notifySettings(next: GhostwriterSettings) {
  mainWindow?.webContents.send("ghosting:settings", next);
  overlayWindow?.webContents.send("overlay:settings", next);
  rebuildTrayMenu();
  repositionOverlay();
}

function notifyShortcutPreview(preview: string) {
  mainWindow?.webContents.send("ghosting:shortcut-preview", preview);
}

function setupIpc(controller: GhostingController) {
  // Auth — renderer sends userId + admin flag so the main process can write to Convex
  ipcMain.handle(
    "auth:set-user-id",
    (_event, userId: string | null, admin?: boolean) => {
      setUserId(userId);
      isAdmin = admin ?? false;
      rebuildTrayMenu();

      // Show overlay only when the user is logged in
      if (userId) {
        if (!overlayWindow) {
          overlayWindow = createOverlayWindow();
        }
      } else {
        if (overlayWindow) {
          overlayWindow.destroy();
          overlayWindow = null;
        }
      }
    },
  );

  ipcMain.handle("ghosting:get-state", () => controller.getState());
  ipcMain.handle("ghosting:start", () => controller.startGhosting());
  ipcMain.handle("ghosting:stop", () => controller.stopGhosting());
  ipcMain.handle("ghosting:cancel", () => controller.cancelGhosting());
  ipcMain.handle("ghosting:toggle", () => {
    const state = controller.getState();
    if (state.phase === "recording") {
      return controller.stopGhosting();
    }
    if (state.phase === "idle" || state.phase === "error") {
      return controller.startGhosting();
    }
    // If transcribing or cleaning, ignore the toggle
  });
  ipcMain.handle(
    "ghosting:get-settings",
    () => settings ?? getDefaultSettings(),
  );
  ipcMain.handle(
    "ghosting:update-settings",
    async (_event, patch: GhostwriterSettingsUpdate) => {
      if (!settings) {
        settings = await loadSettings();
      }
      settings = await updateSettings(settings, patch);
      applyAppVisibilitySettings(settings);
      notifySettings(settings);
      return settings;
    },
  );
  ipcMain.handle(
    "ghosting:start-shortcut-capture",
    (_event, target?: "shortcut" | "toggleShortcut") => {
      capturingShortcutTarget = target ?? "shortcut";
      return settings ?? getDefaultSettings();
    },
  );
  ipcMain.handle("ghosting:stop-shortcut-capture", () => {
    capturingShortcutTarget = null;
  });
  ipcMain.handle("ghosting:get-audio-devices", () => {
    // Invalidate the cached default device when the user browses devices
    // (e.g. opened settings) so the next recording reflects any changes.
    invalidateDefaultDeviceCache();
    return listAudioDevices();
  });
  ipcMain.handle("ghosting:get-default-input-device", () =>
    getDefaultInputDeviceName(),
  );
  ipcMain.handle("ghosting:get-displays", () => {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    return displays.map((d, i) => ({
      id: d.id,
      label: `Display ${i + 1} — ${d.size.width}×${d.size.height}`,
      width: d.size.width,
      height: d.size.height,
      isPrimary: d.id === primary.id,
    }));
  });
  ipcMain.handle(
    "ghosting:start-mic-test",
    async (_event, microphone: string | null) => {
      // Stop any existing test first.
      activeMicTest?.stop();
      // Resolve the real macOS default when no mic is specified.
      const resolvedMic = microphone ?? (await getDefaultInputDeviceName());
      activeMicTest = startMicTest(resolvedMic, (level) => {
        mainWindow?.webContents.send("ghosting:mic-level", level);
      });
    },
  );
  ipcMain.handle("ghosting:stop-mic-test", () => {
    activeMicTest?.stop();
    activeMicTest = null;
  });
  ipcMain.handle("ghosting:get-device-id", () => getDeviceId());
  ipcMain.handle("ghosting:get-local-transcripts", () =>
    loadLocalTranscripts(),
  );
  ipcMain.handle(
    "ghosting:delete-local-transcript",
    (_event, timestamp: number) => deleteLocalTranscript(timestamp),
  );

  // Dictionary
  ipcMain.handle("dictionary:get-all", () => loadDictionary());
  ipcMain.handle(
    "dictionary:add",
    (
      _event,
      entry: { word: string; isCorrection: boolean; misspelling?: string },
    ) => addDictionaryEntry(entry),
  );
  ipcMain.handle("dictionary:delete", (_event, id: string) =>
    deleteDictionaryEntry(id),
  );
  ipcMain.handle("dictionary:sync", (_event, entries: DictionaryEntry[]) =>
    syncDictionary(entries),
  );

  // Snippets
  ipcMain.handle("snippets:get-all", () => loadSnippets());
  ipcMain.handle("snippets:sync", (_event, entries: SnippetEntry[]) =>
    syncSnippets(entries),
  );

  // Vibe Code
  ipcMain.handle("vibecode:get-files", () => loadVibeCodeFiles());
  ipcMain.handle("vibecode:add-file", (_event, filePath: string) =>
    addVibeCodeFile(filePath),
  );
  ipcMain.handle("vibecode:remove-file", (_event, id: string) =>
    removeVibeCodeFile(id),
  );
  ipcMain.handle("vibecode:pick-files", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      title: "Tag files for Vibe Code context",
      message:
        "Select source files to give GhostWriter context about your codebase",
      filters: [
        {
          name: "Source Files",
          extensions: [
            "ts",
            "tsx",
            "js",
            "jsx",
            "py",
            "rs",
            "go",
            "java",
            "kt",
            "swift",
            "c",
            "cpp",
            "h",
            "hpp",
            "cs",
            "rb",
            "php",
            "vue",
            "svelte",
            "html",
            "css",
            "scss",
            "json",
            "yaml",
            "yml",
            "toml",
            "md",
            "txt",
            "sql",
            "graphql",
            "proto",
            "sh",
            "zsh",
            "bash",
            "dockerfile",
          ],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const added: VibeCodeFile[] = [];
    for (const filePath of result.filePaths) {
      const entry = await addVibeCodeFile(filePath);
      added.push(entry);
    }
    return added;
  });

  ipcMain.on("overlay:set-ignore-mouse", (_event, ignore: boolean) => {
    if (!overlayWindow) return;
    if (ignore) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      overlayWindow.setIgnoreMouseEvents(false);
    }
  });
}

async function commitShortcut(shortcut: GhostingShortcut) {
  if (!settings) {
    settings = await loadSettings();
  }
  const target = capturingShortcutTarget ?? "shortcut";
  settings = await updateSettings(settings, { [target]: shortcut });
  notifySettings(settings);
  capturingShortcutTarget = null;
  notifyShortcutPreview("Press new shortcut...");
}

app.whenReady().then(async () => {
  // Set dock icon for macOS
  if (app.dock) {
    const dockIcon = nativeImage.createFromPath(
      resolveAppResourcePath("public/assets", "ghosty-dock.png"),
    );
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  // Standard macOS application menu
  const appMenu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ]);
  Menu.setApplicationMenu(appMenu);

  settings = await loadSettings();
  applyLoginItemSetting(settings.openAtLogin);
  applyDockVisibility(settings.showInDock);

  // Pre-warm the default input device cache so the first ghosting
  // attempt is instant even when "System default" is selected.
  getDefaultInputDeviceName().catch(() => undefined);

  // Pre-start whisper-server so the model is loaded in memory before
  // the user's first ghosting attempt (transcription then takes ~35ms).
  startWhisperServer().catch((err) =>
    console.error("[whisper] failed to pre-start server:", err),
  );

  mainWindow = createMainWindow();
  // Overlay is created lazily when the user logs in (see auth:set-user-id handler)
  applyTrayVisibility(settings.showInTray);
  let lastGhostingPhase: string | null = null;

  const controller = new GhostingController(
    (state) => {
      const currentSettings = settings ?? getDefaultSettings();
      lastGhostingPhase = state.phase;

      mainWindow?.webContents.send("ghosting:state", state);
      overlayWindow?.webContents.send("overlay:state", state);
      if (state.phase === "recording" || state.phase === "idle") {
        if (state.phase === "recording") {
          repositionOverlay();
          // Cancel any pending edit tracking when a new recording starts
          cancelEditTracking();
        }
        // Idle & recording: mouse events enabled so CSS cursor works.
        // On macOS transparent pixels are naturally click-through.
        overlayWindow?.setIgnoreMouseEvents(false);
      } else {
        // Transcribing / cleaning / error: fully click-through
        overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
      }
      if (tray && trayIcons) {
        const icon =
          state.phase === "recording" ? trayIcons.recording : trayIcons.idle;
        tray.setImage(icon);
      }
    },
    () => settings ?? getDefaultSettings(),
    (session) => {
      // Always save cleaned transcript locally
      saveLocalTranscript({
        timestamp: Date.now(),
        cleanedText: session.cleanedText,
        wordCount: session.wordCount,
      }).catch((err) =>
        console.error("[ghostwriter] failed to save local transcript:", err),
      );

      mainWindow?.webContents.send("ghosting:session-complete", {
        ...session,
        timestamp: Date.now(),
      });

      // Start edit tracking for auto-dictionary if enabled
      const currentSettings = settings ?? getDefaultSettings();
      if (currentSettings.autoDictionary && currentSettings.autoPaste) {
        startEditTracking(session.cleanedText);
      }
    },
    (level) => {
      mainWindow?.webContents.send("ghosting:mic-level", level);
      overlayWindow?.webContents.send("overlay:mic-level", level);
    },
  );

  // Set up auto-dictionary correction notifications
  // Buffer corrections so the renderer can pull them via IPC if needed.
  const pendingCorrections: Array<{
    original: string;
    replacement: string;
  }> = [];

  ipcMain.handle("edit-tracker:flush-corrections", () => {
    const batch = pendingCorrections.splice(0, pendingCorrections.length);
    return batch;
  });

  setOnCorrectionsDetected((corrections) => {
    console.log(
      "[ghostwriter] auto-dictionary corrections:",
      corrections.map((c) => `"${c.original}" → "${c.replacement}"`),
    );
    // Persist each correction directly to Convex from the main process
    for (const c of corrections) {
      pendingCorrections.push(c);
      addAutoCorrectionToConvex(c).then((ok) => {
        if (ok) {
          console.log(
            `[ghostwriter] synced correction "${c.original}" → "${c.replacement}" to Convex`,
          );
        }
      });
    }
    // Notify renderer that corrections are available
    mainWindow?.webContents.send("edit-tracker:corrections-available");
  });

  setupIpc(controller);

  unregisterHotkey = registerGhostingHotkey({
    getShortcut: () => settings?.shortcut ?? null,
    getToggleShortcut: () => settings?.toggleShortcut ?? null,
    isCaptureActive: () => capturingShortcutTarget !== null,
    onCapturePreview: notifyShortcutPreview,
    onCaptureComplete: (shortcut) => {
      void commitShortcut(shortcut);
    },
    onStart: () => {
      const s = settings ?? getDefaultSettings();
      if (s.soundEffectsEnabled) playGhostingTransitionSound("start");
      controller.startGhosting();
    },
    onStop: () => {
      const s = settings ?? getDefaultSettings();
      if (s.soundEffectsEnabled) playGhostingTransitionSound("stop");
      controller.stopGhosting();
    },
    onToggle: () => {
      const state = controller.getState();
      const s = settings ?? getDefaultSettings();
      if (state.phase === "recording") {
        if (s.soundEffectsEnabled) playGhostingTransitionSound("stop");
        return controller.stopGhosting();
      }
      if (state.phase === "idle" || state.phase === "error") {
        if (s.soundEffectsEnabled) playGhostingTransitionSound("start");
        return controller.startGhosting();
      }
    },
  });

  // Forward global keystrokes to editTracker so it can reset its idle timer.
  // This MUST be added after registerGhostingHotkey (which calls uIOhook.start()).
  uIOhook.on("keydown", () => editTrackerKeystroke());
});

app.on("activate", () => {
  if (!mainWindow) {
    mainWindow = createMainWindow();
  }

  mainWindow.show();
});

app.on("before-quit", () => {
  isQuitting = true;
  unregisterHotkey?.();
  destroyTray();
  stopWhisperServer();
  overlayWindow?.destroy();
  overlayWindow = null;
  mainWindow = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
