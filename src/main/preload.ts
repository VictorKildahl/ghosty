import { contextBridge, ipcRenderer } from "electron";
import type {
  AudioDevice,
  GhostingState,
  GhosttypeSettings,
  GhosttypeSettingsUpdate,
  LocalTranscript,
  SessionEvent,
} from "../../types/ghosttype";

const api = {
  getState: () =>
    ipcRenderer.invoke("ghosting:get-state") as Promise<GhostingState>,
  startGhosting: () => ipcRenderer.invoke("ghosting:start"),
  stopGhosting: () => ipcRenderer.invoke("ghosting:stop"),
  getSettings: () =>
    ipcRenderer.invoke("ghosting:get-settings") as Promise<GhosttypeSettings>,
  updateSettings: (patch: GhosttypeSettingsUpdate) =>
    ipcRenderer.invoke(
      "ghosting:update-settings",
      patch,
    ) as Promise<GhosttypeSettings>,
  getAudioDevices: () =>
    ipcRenderer.invoke("ghosting:get-audio-devices") as Promise<AudioDevice[]>,
  startShortcutCapture: () =>
    ipcRenderer.invoke(
      "ghosting:start-shortcut-capture",
    ) as Promise<GhosttypeSettings>,
  stopShortcutCapture: () =>
    ipcRenderer.invoke("ghosting:stop-shortcut-capture"),
  getDeviceId: () =>
    ipcRenderer.invoke("ghosting:get-device-id") as Promise<string>,
  getLocalTranscripts: () =>
    ipcRenderer.invoke("ghosting:get-local-transcripts") as Promise<
      LocalTranscript[]
    >,
  onGhostingState: (callback: (state: GhostingState) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: GhostingState,
    ) => {
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
      settings: GhosttypeSettings,
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
  },
  onSessionComplete: (callback: (session: SessionEvent) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      session: SessionEvent,
    ) => {
      callback(session);
    };

    ipcRenderer.on("ghosting:session-complete", listener);

    return () => {
      ipcRenderer.removeListener("ghosting:session-complete", listener);
    };
  },
};

contextBridge.exposeInMainWorld("ghosttype", api);
