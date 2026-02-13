import { contextBridge, ipcRenderer } from "electron";
import type {
  AudioDevice,
  AutoCorrection,
  DictionaryEntry,
  DisplayInfo,
  GhostingState,
  GhostwriterSettings,
  GhostwriterSettingsUpdate,
  LocalTranscript,
  SessionEvent,
  SnippetEntry,
  VibeCodeFile,
} from "../../types/ghostwriter";

const api = {
  getState: () =>
    ipcRenderer.invoke("ghosting:get-state") as Promise<GhostingState>,
  startGhosting: () => ipcRenderer.invoke("ghosting:start"),
  stopGhosting: () => ipcRenderer.invoke("ghosting:stop"),
  getSettings: () =>
    ipcRenderer.invoke("ghosting:get-settings") as Promise<GhostwriterSettings>,
  updateSettings: (patch: GhostwriterSettingsUpdate) =>
    ipcRenderer.invoke(
      "ghosting:update-settings",
      patch,
    ) as Promise<GhostwriterSettings>,
  getAudioDevices: () =>
    ipcRenderer.invoke("ghosting:get-audio-devices") as Promise<AudioDevice[]>,
  getDefaultInputDevice: () =>
    ipcRenderer.invoke("ghosting:get-default-input-device") as Promise<
      string | null
    >,
  getDisplays: () =>
    ipcRenderer.invoke("ghosting:get-displays") as Promise<DisplayInfo[]>,
  startMicTest: (microphone: string | null) =>
    ipcRenderer.invoke("ghosting:start-mic-test", microphone) as Promise<void>,
  stopMicTest: () =>
    ipcRenderer.invoke("ghosting:stop-mic-test") as Promise<void>,
  onMicLevel: (callback: (level: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, level: number) => {
      callback(level);
    };

    ipcRenderer.on("ghosting:mic-level", listener);

    return () => {
      ipcRenderer.removeListener("ghosting:mic-level", listener);
    };
  },
  startShortcutCapture: (target?: "shortcut" | "toggleShortcut") =>
    ipcRenderer.invoke(
      "ghosting:start-shortcut-capture",
      target,
    ) as Promise<GhostwriterSettings>,
  stopShortcutCapture: () =>
    ipcRenderer.invoke("ghosting:stop-shortcut-capture"),
  getDeviceId: () =>
    ipcRenderer.invoke("ghosting:get-device-id") as Promise<string>,
  getLocalTranscripts: () =>
    ipcRenderer.invoke("ghosting:get-local-transcripts") as Promise<
      LocalTranscript[]
    >,
  deleteLocalTranscript: (timestamp: number) =>
    ipcRenderer.invoke(
      "ghosting:delete-local-transcript",
      timestamp,
    ) as Promise<void>,
  getDictionary: () =>
    ipcRenderer.invoke("dictionary:get-all") as Promise<DictionaryEntry[]>,
  addDictionaryEntry: (entry: Omit<DictionaryEntry, "id" | "createdAt">) =>
    ipcRenderer.invoke("dictionary:add", entry) as Promise<DictionaryEntry>,
  deleteDictionaryEntry: (id: string) =>
    ipcRenderer.invoke("dictionary:delete", id) as Promise<void>,
  syncDictionary: (entries: DictionaryEntry[]) =>
    ipcRenderer.invoke("dictionary:sync", entries) as Promise<void>,
  getSnippets: () =>
    ipcRenderer.invoke("snippets:get-all") as Promise<SnippetEntry[]>,
  syncSnippets: (entries: SnippetEntry[]) =>
    ipcRenderer.invoke("snippets:sync", entries) as Promise<void>,
  getVibeCodeFiles: () =>
    ipcRenderer.invoke("vibecode:get-files") as Promise<VibeCodeFile[]>,
  addVibeCodeFile: (filePath: string) =>
    ipcRenderer.invoke("vibecode:add-file", filePath) as Promise<VibeCodeFile>,
  removeVibeCodeFile: (id: string) =>
    ipcRenderer.invoke("vibecode:remove-file", id) as Promise<void>,
  pickVibeCodeFiles: () =>
    ipcRenderer.invoke("vibecode:pick-files") as Promise<VibeCodeFile[]>,
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
  onSettings: (callback: (settings: GhostwriterSettings) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: GhostwriterSettings,
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
  flushAutoCorrections: () =>
    ipcRenderer.invoke("edit-tracker:flush-corrections") as Promise<
      AutoCorrection[]
    >,
  onAutoCorrections: (callback: () => void) => {
    const listener = () => {
      callback();
    };

    ipcRenderer.on("edit-tracker:corrections-available", listener);

    return () => {
      ipcRenderer.removeListener(
        "edit-tracker:corrections-available",
        listener,
      );
    };
  },
  setUserId: (userId: string | null, isAdmin?: boolean) =>
    ipcRenderer.invoke("auth:set-user-id", userId, isAdmin) as Promise<void>,
};

contextBridge.exposeInMainWorld("ghostwriter", api);
