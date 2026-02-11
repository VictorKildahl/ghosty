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

export type WritingStyle = "formal" | "casual" | "very-casual" | "excited";

export type AppCategory = "personal" | "work" | "email" | "code" | "other";

export type StylePreferences = Record<AppCategory, WritingStyle>;

export type VibeCodeFile = {
  id: string;
  filePath: string;
  label: string;
  addedAt: number;
};

export type GhosttypeSettings = {
  autoPaste: boolean;
  shortcut: GhostingShortcut;
  selectedMicrophone: string | null;
  aiCleanup: boolean;
  aiModel: string;
  shareTranscripts: boolean;
  stylePreferences: StylePreferences;
  overlayDisplayId: number | null;
  vibeCodeEnabled: boolean;
  autoFileDetection: boolean;
  editorFileTagging: boolean;
};

export type GhosttypeSettingsUpdate = {
  autoPaste?: boolean;
  shortcut?: GhostingShortcutInput | GhostingShortcut;
  selectedMicrophone?: string | null;
  aiCleanup?: boolean;
  aiModel?: string;
  shareTranscripts?: boolean;
  stylePreferences?: Partial<StylePreferences>;
  overlayDisplayId?: number | null;
  vibeCodeEnabled?: boolean;
  autoFileDetection?: boolean;
  editorFileTagging?: boolean;
};

export type SessionEvent = {
  wordCount: number;
  durationMs: number;
  rawLength: number;
  cleanedLength: number;
  rawText: string;
  cleanedText: string;
  appName?: string;
  timestamp: number;
};

export type LocalTranscript = {
  timestamp: number;
  cleanedText: string;
  wordCount: number;
};

export type DictionaryEntry = {
  id: string;
  word: string;
  isCorrection: boolean;
  misspelling?: string;
  createdAt: number;
};

export type SnippetEntry = {
  id: string;
  snippet: string;
  expansion: string;
  createdAt: number;
};

export type DisplayInfo = {
  id: number;
  label: string;
  width: number;
  height: number;
  isPrimary: boolean;
};

export type GhostTypeAPI = {
  getShowModelPicker: () => boolean;
  getState: () => Promise<GhostingState>;
  startGhosting: () => Promise<void>;
  stopGhosting: () => Promise<void>;
  getSettings: () => Promise<GhosttypeSettings>;
  updateSettings: (
    patch: GhosttypeSettingsUpdate,
  ) => Promise<GhosttypeSettings>;
  getAudioDevices: () => Promise<AudioDevice[]>;
  getDefaultInputDevice: () => Promise<string | null>;
  getDisplays: () => Promise<DisplayInfo[]>;
  startMicTest: (microphone: string | null) => Promise<void>;
  stopMicTest: () => Promise<void>;
  onMicLevel: (callback: (level: number) => void) => () => void;
  startShortcutCapture: () => Promise<GhosttypeSettings>;
  stopShortcutCapture: () => Promise<void>;
  getDeviceId: () => Promise<string>;
  getLocalTranscripts: () => Promise<LocalTranscript[]>;
  deleteLocalTranscript: (timestamp: number) => Promise<void>;
  getDictionary: () => Promise<DictionaryEntry[]>;
  addDictionaryEntry: (
    entry: Omit<DictionaryEntry, "id" | "createdAt">,
  ) => Promise<DictionaryEntry>;
  deleteDictionaryEntry: (id: string) => Promise<void>;
  syncDictionary: (entries: DictionaryEntry[]) => Promise<void>;
  getSnippets: () => Promise<SnippetEntry[]>;
  syncSnippets: (entries: SnippetEntry[]) => Promise<void>;
  getVibeCodeFiles: () => Promise<VibeCodeFile[]>;
  addVibeCodeFile: (filePath: string) => Promise<VibeCodeFile>;
  removeVibeCodeFile: (id: string) => Promise<void>;
  pickVibeCodeFiles: () => Promise<VibeCodeFile[]>;
  onGhostingState: (callback: (state: GhostingState) => void) => () => void;
  onSettings: (callback: (settings: GhosttypeSettings) => void) => () => void;
  onShortcutPreview: (callback: (preview: string) => void) => () => void;
  onSessionComplete: (callback: (session: SessionEvent) => void) => () => void;
};

declare global {
  interface Window {
    ghosttype?: GhostTypeAPI;
  }
}

export {};
