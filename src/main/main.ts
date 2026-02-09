import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
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

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let unregisterHotkey: (() => void) | null = null;
let isQuitting = false;
let trayIcons: {
  idle: Electron.NativeImage;
  recording: Electron.NativeImage;
} | null = null;
let settings: GhosttypeSettings | null = null;
let isCapturingShortcut = false;

const isDev = !app.isPackaged;

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
    width: 480,
    height: 680,
    resizable: false,
    show: false,
    backgroundColor: "#f4f1ea",
    title: "GhostType",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.setMenuBarVisibility(false);

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });

  win.loadURL(resolveRendererUrl());

  return win;
}

function loadTrayIcon(name: string) {
  const iconPath = resolveAppResourcePath("assets", name);
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    return nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0n4dQAAAAASUVORK5CYII=",
    );
  }
  icon.setTemplateImage(true);
  return icon;
}

function createTray() {
  trayIcons = {
    idle: loadTrayIcon("trayTemplate.png"),
    recording: loadTrayIcon("trayRecordingTemplate.png"),
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

  const menu = Menu.buildFromTemplate([
    { label: "Toggle GhostType", click: toggleWindow },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("GhostType");
  tray.setContextMenu(menu);
}

function notifySettings(next: GhosttypeSettings) {
  mainWindow?.webContents.send("ghosting:settings", next);
}

function notifyShortcutPreview(preview: string) {
  mainWindow?.webContents.send("ghosting:shortcut-preview", preview);
}

function setupIpc(controller: GhostingController) {
  ipcMain.handle("ghosting:get-state", () => controller.getState());
  ipcMain.handle("ghosting:start", () => controller.startGhosting());
  ipcMain.handle("ghosting:stop", () => controller.stopGhosting());
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
  app.dock?.hide();
  Menu.setApplicationMenu(null);

  settings = await loadSettings();

  mainWindow = createMainWindow();
  createTray();

  const controller = new GhostingController(
    (state) => {
      mainWindow?.webContents.send("ghosting:state", state);
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
  mainWindow = null;
});

app.on("window-all-closed", () => {
  // Prevent app from quitting when all windows are closed.
});
