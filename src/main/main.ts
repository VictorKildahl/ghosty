import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { AI_MODEL_OPTIONS } from "../../types/models";
import { listAudioDevices } from "./audio";
import { GhostingController } from "./ghosting";
import { registerGhostingHotkey } from "./hotkey";
import {
  getDefaultSettings,
  loadSettings,
  updateSettings,
  type GhostingShortcut,
  type GhosttypeSettings,
  type GhosttypeSettingsUpdate,
} from "./settings";

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
let settings: GhosttypeSettings | null = null;
let isCapturingShortcut = false;

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
    width: 1000,
    height: 800,
    resizable: true,
    show: false,
    backgroundColor: "#ffffff",
    title: "GhostType",
    icon: resolveAppResourcePath("public/assets", "ghosty-dock.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.on("close", () => {
    isQuitting = true;
    app.quit();
  });

  win.loadURL(resolveRendererUrl());

  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
}

const OVERLAY_WIDTH = 300;
const OVERLAY_HEIGHT = 120;

function createOverlayWindow() {
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
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
    focusable: true,
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
  win.setIgnoreMouseEvents(true, { forward: true });

  const overlayPath = resolveAppResourcePath("resources", "overlay.html");
  win.loadFile(overlayPath);

  win.once("ready-to-show", () => {
    win.showInactive();
  });

  return win;
}

function repositionOverlay() {
  if (!overlayWindow) return;
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
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

function createTray() {
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
  tray.setToolTip("GhostType");

  // Cache audio devices and build menu
  listAudioDevices()
    .then((devices) => {
      cachedAudioDevices = devices;
      rebuildTrayMenu();
    })
    .catch(() => rebuildTrayMenu());
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
      label: "Default (device :0)",
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

  const menu = Menu.buildFromTemplate([
    { label: "Open GhostType", click: toggleWindow },
    { type: "separator" },
    { label: "Microphone", submenu: micSubmenu },
    { label: "AI Model", submenu: modelSubmenu },
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

function notifySettings(next: GhosttypeSettings) {
  mainWindow?.webContents.send("ghosting:settings", next);
  overlayWindow?.webContents.send("overlay:settings", next);
  rebuildTrayMenu();
}

function notifyShortcutPreview(preview: string) {
  mainWindow?.webContents.send("ghosting:shortcut-preview", preview);
}

function setupIpc(controller: GhostingController) {
  ipcMain.handle("ghosting:get-state", () => controller.getState());
  ipcMain.handle("ghosting:start", () => controller.startGhosting());
  ipcMain.handle("ghosting:stop", () => controller.stopGhosting());
  ipcMain.handle("ghosting:cancel", () => controller.cancelGhosting());
  ipcMain.handle(
    "ghosting:get-settings",
    () => settings ?? getDefaultSettings(),
  );
  ipcMain.handle(
    "ghosting:update-settings",
    async (_event, patch: GhosttypeSettingsUpdate) => {
      if (!settings) {
        settings = await loadSettings();
      }
      settings = await updateSettings(settings, patch);
      notifySettings(settings);
      return settings;
    },
  );
  ipcMain.handle("ghosting:start-shortcut-capture", () => {
    isCapturingShortcut = true;
    return settings ?? getDefaultSettings();
  });
  ipcMain.handle("ghosting:stop-shortcut-capture", () => {
    isCapturingShortcut = false;
  });
  ipcMain.handle("ghosting:get-audio-devices", () => listAudioDevices());

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
  settings = await updateSettings(settings, { shortcut });
  notifySettings(settings);
  isCapturingShortcut = false;
  notifyShortcutPreview("Press new shortcut...");
}

app.whenReady().then(async () => {
  // Show in dock like a normal macOS app
  if (app.dock) {
    await app.dock.show();
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

  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();
  createTray();

  const controller = new GhostingController(
    (state) => {
      mainWindow?.webContents.send("ghosting:state", state);
      overlayWindow?.webContents.send("overlay:state", state);
      if (state.phase === "recording") {
        repositionOverlay();
        // Recording controls need to be clickable
        overlayWindow?.setIgnoreMouseEvents(false);
      } else {
        // Other phases: click-through with mouse event forwarding
        overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
      }
      if (tray && trayIcons) {
        const icon =
          state.phase === "recording" ? trayIcons.recording : trayIcons.idle;
        tray.setImage(icon);
      }
    },
    () => settings ?? getDefaultSettings(),
  );

  setupIpc(controller);

  unregisterHotkey = registerGhostingHotkey({
    getShortcut: () => settings?.shortcut ?? getDefaultSettings().shortcut,
    isCaptureActive: () => isCapturingShortcut,
    onCapturePreview: notifyShortcutPreview,
    onCaptureComplete: (shortcut) => {
      void commitShortcut(shortcut);
    },
    onStart: () => controller.startGhosting(),
    onStop: () => controller.stopGhosting(),
  });
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
  tray?.destroy();
  overlayWindow?.destroy();
  overlayWindow = null;
  mainWindow = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
