import { contextBridge, ipcRenderer } from "electron";
import type { AudioDevice, GhostingState, GhosttypeSettings, GhosttypeSettingsUpdate } from "../../types/ghosttype";

const api = {
  getState: () => ipcRenderer.invoke("ghosting:get-state") as Promise<GhostingState>,
  startGhosting: () => ipcRenderer.invoke("ghosting:start"),
  stopGhosting: () => ipcRenderer.invoke("ghosting:stop"),
  getSettings: () =>
    ipcRenderer.invoke("ghosting:get-settings") as Promise<GhosttypeSettings>,
  updateSettings: (patch: GhosttypeSettingsUpdate) =>
    ipcRenderer.invoke("ghosting:update-settings", patch) as Promise<GhosttypeSettings>,
  getAudioDevices: () =>
    ipcRenderer.invoke("ghosting:get-audio-devices") as Promise<AudioDevice[]>,
  startShortcutCapture: () =>
    ipcRenderer.invoke("ghosting:start-shortcut-capture") as Promise<GhosttypeSettings>,
  stopShortcutCapture: () => ipcRenderer.invoke("ghosting:stop-shortcut-capture"),
  onGhostingState: (callback: (state: GhostingState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: GhostingState) => {
      callback(state);
    };

    ipcRenderer.on("ghosting:state", listener);

    return () => {
      ipcRenderer.removeListener("ghosting:state", listener);
    };
  },
  onSettings: (callback: (settings: GhosttypeSettings) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: GhosttypeSettings
    ) => {
      callback(settings);
    };

    ipcRenderer.on("ghosting:settings", listener);

    return () => {
      ipcRenderer.removeListener("ghosting:settings", listener);
    };
  },
  onShortcutPreview: (callback: (preview: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, preview: string) => {
      callback(preview);
    };

    ipcRenderer.on("ghosting:shortcut-preview", listener);

    return () => {
      ipcRenderer.removeListener("ghosting:shortcut-preview", listener);
    };
  }
};

contextBridge.exposeInMainWorld("ghosttype", api);
