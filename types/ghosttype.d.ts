export type GhostingPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "cleaning"
  | "error";

export type GhostingState = {
  phase: GhostingPhase;
  lastGhostedText: string;
  lastRawText: string;
  error: string | null;
};

export type GhostingShortcut = {
  key: string;
  keycode: number;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
};

export type GhostingShortcutInput = {
  code: string;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
};

export type AudioDevice = {
  index: number;
  name: string;
};

export type GhosttypeSettings = {
  autoPaste: boolean;
  shortcut: GhostingShortcut;
  selectedMicrophone: string | null;
};

export type GhosttypeSettingsUpdate = {
  autoPaste?: boolean;
  shortcut?: GhostingShortcutInput | GhostingShortcut;
  selectedMicrophone?: string | null;
};

export type GhostTypeAPI = {
  getState: () => Promise<GhostingState>;
  startGhosting: () => Promise<void>;
  stopGhosting: () => Promise<void>;
  getSettings: () => Promise<GhosttypeSettings>;
  updateSettings: (patch: GhosttypeSettingsUpdate) => Promise<GhosttypeSettings>;
  getAudioDevices: () => Promise<AudioDevice[]>;
  startShortcutCapture: () => Promise<GhosttypeSettings>;
  stopShortcutCapture: () => Promise<void>;
  onGhostingState: (callback: (state: GhostingState) => void) => () => void;
  onSettings: (callback: (settings: GhosttypeSettings) => void) => () => void;
  onShortcutPreview: (callback: (preview: string) => void) => () => void;
};

declare global {
  interface Window {
    ghosttype?: GhostTypeAPI;
  }
}

export {};
