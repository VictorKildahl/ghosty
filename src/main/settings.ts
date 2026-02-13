import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { UiohookKey } from "uiohook-napi";
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE,
  DEFAULT_TRANSCRIPTION_LANGUAGES,
  TRANSCRIPTION_LANGUAGES,
  normalizeTranscriptionLanguageSelection,
  toVisibleTranscriptionLanguageCode,
  type SelectableTranscriptionLanguage,
  type TranscriptionLanguage,
} from "../../types/languages";
import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL } from "../../types/models";

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

export type WritingStyle = "formal" | "casual" | "very-casual" | "excited";

export type AppCategory = "personal" | "work" | "email" | "code" | "other";

export type StylePreferences = Record<AppCategory, WritingStyle>;

export type GhostwriterSettings = {
  autoPaste: boolean;
  shortcut: GhostingShortcut | null;
  toggleShortcut: GhostingShortcut | null;
  selectedMicrophone: string | null;
  transcriptionLanguage: TranscriptionLanguage;
  transcriptionLanguages: SelectableTranscriptionLanguage[];
  soundEffectsEnabled: boolean;
  showInTray: boolean;
  showInDock: boolean;
  openAtLogin: boolean;
  aiCleanup: boolean;
  aiModel: string;
  shareTranscripts: boolean;
  stylePreferences: StylePreferences;
  overlayDisplayId: number | null;
  vibeCodeEnabled: boolean;
  autoFileDetection: boolean;
  editorFileTagging: boolean;
  autoDictionary: boolean;
};

export type GhostwriterSettingsUpdate = {
  autoPaste?: boolean;
  shortcut?: GhostingShortcutInput | GhostingShortcut | null;
  toggleShortcut?: GhostingShortcutInput | GhostingShortcut | null;
  selectedMicrophone?: string | null;
  transcriptionLanguage?: TranscriptionLanguage;
  transcriptionLanguages?: SelectableTranscriptionLanguage[];
  soundEffectsEnabled?: boolean;
  showInTray?: boolean;
  showInDock?: boolean;
  openAtLogin?: boolean;
  aiCleanup?: boolean;
  aiModel?: string;
  shareTranscripts?: boolean;
  stylePreferences?: Partial<StylePreferences>;
  overlayDisplayId?: number | null;
  vibeCodeEnabled?: boolean;
  autoFileDetection?: boolean;
  editorFileTagging?: boolean;
  autoDictionary?: boolean;
};

const DEFAULT_SETTINGS: GhostwriterSettings = {
  autoPaste: true,
  shortcut: {
    key: "Space",
    keycode: UiohookKey.Space,
    meta: true,
    shift: true,
    alt: false,
    ctrl: false,
  },
  toggleShortcut: null,
  selectedMicrophone: null,
  transcriptionLanguage: DEFAULT_TRANSCRIPTION_LANGUAGE,
  transcriptionLanguages: [...DEFAULT_TRANSCRIPTION_LANGUAGES],
  soundEffectsEnabled: true,
  showInTray: true,
  showInDock: true,
  openAtLogin: false,
  aiCleanup: true,
  aiModel: DEFAULT_AI_MODEL,
  shareTranscripts: false,
  stylePreferences: {
    personal: "casual",
    work: "casual",
    email: "casual",
    code: "casual",
    other: "casual",
  },
  overlayDisplayId: null,
  vibeCodeEnabled: false,
  autoFileDetection: false,
  editorFileTagging: false,
  autoDictionary: true,
};

const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

const TRANSCRIPTION_LANGUAGE_CODES = new Set(
  TRANSCRIPTION_LANGUAGES.map((lang) => lang.code),
);

const MODIFIER_KEYCODES: Set<number> = new Set([
  UiohookKey.Meta,
  UiohookKey.MetaRight,
  UiohookKey.Shift,
  UiohookKey.ShiftRight,
  UiohookKey.Alt,
  UiohookKey.AltRight,
  UiohookKey.Ctrl,
  UiohookKey.CtrlRight,
]);

const SPECIAL_KEYS: Record<string, { key: string; keycode: number }> = {
  Space: { key: "Space", keycode: UiohookKey.Space },
  Enter: { key: "Enter", keycode: UiohookKey.Enter },
  Tab: { key: "Tab", keycode: UiohookKey.Tab },
  Escape: { key: "Esc", keycode: UiohookKey.Escape },
  Backspace: { key: "Backspace", keycode: UiohookKey.Backspace },
  Delete: { key: "Delete", keycode: UiohookKey.Delete },
  Insert: { key: "Insert", keycode: UiohookKey.Insert },
  ArrowUp: { key: "Up", keycode: UiohookKey.ArrowUp },
  ArrowDown: { key: "Down", keycode: UiohookKey.ArrowDown },
  ArrowLeft: { key: "Left", keycode: UiohookKey.ArrowLeft },
  ArrowRight: { key: "Right", keycode: UiohookKey.ArrowRight },
  Home: { key: "Home", keycode: UiohookKey.Home },
  End: { key: "End", keycode: UiohookKey.End },
  PageUp: { key: "PageUp", keycode: UiohookKey.PageUp },
  PageDown: { key: "PageDown", keycode: UiohookKey.PageDown },
  Minus: { key: "-", keycode: UiohookKey.Minus },
  Equal: { key: "=", keycode: UiohookKey.Equal },
  BracketLeft: { key: "[", keycode: UiohookKey.BracketLeft },
  BracketRight: { key: "]", keycode: UiohookKey.BracketRight },
  Backslash: { key: "\\", keycode: UiohookKey.Backslash },
  Semicolon: { key: ";", keycode: UiohookKey.Semicolon },
  Quote: { key: "'", keycode: UiohookKey.Quote },
  Backquote: { key: "`", keycode: UiohookKey.Backquote },
  Comma: { key: ",", keycode: UiohookKey.Comma },
  Period: { key: ".", keycode: UiohookKey.Period },
  Slash: { key: "/", keycode: UiohookKey.Slash },
};

const DIGIT_KEYCODES: Record<string, number> = {
  "0": (UiohookKey as Record<string, number>)["0"],
  "1": (UiohookKey as Record<string, number>)["1"],
  "2": (UiohookKey as Record<string, number>)["2"],
  "3": (UiohookKey as Record<string, number>)["3"],
  "4": (UiohookKey as Record<string, number>)["4"],
  "5": (UiohookKey as Record<string, number>)["5"],
  "6": (UiohookKey as Record<string, number>)["6"],
  "7": (UiohookKey as Record<string, number>)["7"],
  "8": (UiohookKey as Record<string, number>)["8"],
  "9": (UiohookKey as Record<string, number>)["9"],
};

const KEYCODE_LABELS: Record<number, string> = {
  [UiohookKey.Space]: "Space",
  [UiohookKey.Enter]: "Enter",
  [UiohookKey.Tab]: "Tab",
  [UiohookKey.Escape]: "Esc",
  [UiohookKey.Backspace]: "Backspace",
  [UiohookKey.Delete]: "Delete",
  [UiohookKey.Insert]: "Insert",
  [UiohookKey.ArrowUp]: "Up",
  [UiohookKey.ArrowDown]: "Down",
  [UiohookKey.ArrowLeft]: "Left",
  [UiohookKey.ArrowRight]: "Right",
  [UiohookKey.Home]: "Home",
  [UiohookKey.End]: "End",
  [UiohookKey.PageUp]: "PageUp",
  [UiohookKey.PageDown]: "PageDown",
  [UiohookKey.Minus]: "-",
  [UiohookKey.Equal]: "=",
  [UiohookKey.BracketLeft]: "[",
  [UiohookKey.BracketRight]: "]",
  [UiohookKey.Backslash]: "\\",
  [UiohookKey.Semicolon]: ";",
  [UiohookKey.Quote]: "'",
  [UiohookKey.Backquote]: "`",
  [UiohookKey.Comma]: ",",
  [UiohookKey.Period]: ".",
  [UiohookKey.Slash]: "/",
};

for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const code = (UiohookKey as Record<string, number>)[letter];
  if (code) KEYCODE_LABELS[code] = letter;
}

for (const digit of Object.keys(DIGIT_KEYCODES)) {
  KEYCODE_LABELS[DIGIT_KEYCODES[digit]] = digit;
}

for (let i = 1; i <= 24; i += 1) {
  const name = `F${i}`;
  const code = (UiohookKey as Record<string, number>)[name];
  if (code) KEYCODE_LABELS[code] = name;
}

function resolveShortcut(input: GhostingShortcutInput): GhostingShortcut {
  if (MODIFIER_CODES.has(input.code)) {
    throw new Error("Choose a non-modifier key for the shortcut.");
  }

  const modifiers = {
    meta: input.meta,
    shift: input.shift,
    alt: input.alt,
    ctrl: input.ctrl,
  };

  let resolved = SPECIAL_KEYS[input.code];
  if (!resolved && input.code.startsWith("Key")) {
    const letter = input.code.slice(3).toUpperCase();
    const keycode = (UiohookKey as Record<string, number>)[letter];
    if (keycode) {
      resolved = { key: letter, keycode };
    }
  }

  if (!resolved && input.code.startsWith("Digit")) {
    const digit = input.code.slice(5);
    const keycode = DIGIT_KEYCODES[digit];
    if (keycode) {
      resolved = { key: digit, keycode };
    }
  }

  if (!resolved && /^F\d{1,2}$/.test(input.code)) {
    const keycode = (UiohookKey as Record<string, number>)[input.code];
    if (keycode) {
      resolved = { key: input.code, keycode };
    }
  }

  if (!resolved) {
    throw new Error("Unsupported key. Use letters, numbers, or common keys.");
  }

  const hasModifier =
    modifiers.meta || modifiers.shift || modifiers.alt || modifiers.ctrl;
  if (!hasModifier && resolved.key.length === 1) {
    throw new Error("Add at least one modifier (Cmd, Ctrl, Opt, Shift).");
  }

  return {
    key: resolved.key,
    keycode: resolved.keycode,
    ...modifiers,
  };
}

function isResolvedShortcut(
  shortcut: GhostingShortcutInput | GhostingShortcut,
): shortcut is GhostingShortcut {
  return (shortcut as GhostingShortcut).keycode !== undefined;
}

export function isModifierKeycode(keycode: number) {
  return MODIFIER_KEYCODES.has(keycode);
}

export function formatShortcutPreview(
  modifiers: { meta: boolean; shift: boolean; alt: boolean; ctrl: boolean },
  key?: string,
) {
  const parts: string[] = [];
  if (modifiers.meta) parts.push("Cmd");
  if (modifiers.ctrl) parts.push("Ctrl");
  if (modifiers.alt) parts.push("Opt");
  if (modifiers.shift) parts.push("Shift");
  if (key) parts.push(key);
  return parts.length ? parts.join(" + ") : "Press new shortcut...";
}

export function shortcutFromKeycode(
  keycode: number,
  modifiers: { meta: boolean; shift: boolean; alt: boolean; ctrl: boolean },
): GhostingShortcut {
  if (isModifierKeycode(keycode)) {
    throw new Error("Choose a non-modifier key for the shortcut.");
  }

  const key = KEYCODE_LABELS[keycode];
  if (!key) {
    throw new Error("Unsupported key. Use letters, numbers, or common keys.");
  }

  const hasModifier =
    modifiers.meta || modifiers.shift || modifiers.alt || modifiers.ctrl;
  if (!hasModifier && key.length === 1) {
    throw new Error("Add at least one modifier (Cmd, Ctrl, Opt, Shift).");
  }

  return {
    key,
    keycode,
    ...modifiers,
  };
}

function normalizePrimaryLanguage(
  language: TranscriptionLanguage,
): SelectableTranscriptionLanguage {
  return (
    toVisibleTranscriptionLanguageCode(language) ??
    DEFAULT_TRANSCRIPTION_LANGUAGES[0]
  );
}

function normalizeLanguageSelection(
  rawCodes: unknown,
  fallback: SelectableTranscriptionLanguage,
) {
  const normalized = normalizeTranscriptionLanguageSelection(
    Array.isArray(rawCodes)
      ? rawCodes.filter((value): value is string => typeof value === "string")
      : undefined,
  );
  return normalized.length > 0 ? normalized : [fallback];
}

function coerceSettings(raw: unknown): GhostwriterSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const record = raw as Record<string, unknown>;

  const autoPaste =
    typeof record.autoPaste === "boolean"
      ? record.autoPaste
      : DEFAULT_SETTINGS.autoPaste;

  const shortcutRaw = record.shortcut as
    | Partial<GhostingShortcut>
    | null
    | undefined;
  const shortcut =
    record.shortcut === null
      ? null
      : shortcutRaw &&
          typeof shortcutRaw.key === "string" &&
          typeof shortcutRaw.keycode === "number" &&
          typeof shortcutRaw.meta === "boolean" &&
          typeof shortcutRaw.shift === "boolean" &&
          typeof shortcutRaw.alt === "boolean" &&
          typeof shortcutRaw.ctrl === "boolean"
        ? (shortcutRaw as GhostingShortcut)
        : DEFAULT_SETTINGS.shortcut;

  const selectedMicrophone =
    typeof record.selectedMicrophone === "string"
      ? record.selectedMicrophone
      : null;

  const rawTranscriptionLanguage =
    typeof record.transcriptionLanguage === "string" &&
    TRANSCRIPTION_LANGUAGE_CODES.has(
      record.transcriptionLanguage as TranscriptionLanguage,
    )
      ? (record.transcriptionLanguage as TranscriptionLanguage)
      : DEFAULT_SETTINGS.transcriptionLanguage;
  const fallbackTranscriptionLanguage =
    rawTranscriptionLanguage === "auto"
      ? DEFAULT_TRANSCRIPTION_LANGUAGES[0]
      : normalizePrimaryLanguage(rawTranscriptionLanguage);
  const transcriptionLanguages = normalizeLanguageSelection(
    record.transcriptionLanguages,
    fallbackTranscriptionLanguage,
  );
  const transcriptionLanguage =
    rawTranscriptionLanguage === "auto"
      ? "auto"
      : (transcriptionLanguages[0] ?? fallbackTranscriptionLanguage);

  const soundEffectsEnabled =
    typeof record.soundEffectsEnabled === "boolean"
      ? record.soundEffectsEnabled
      : DEFAULT_SETTINGS.soundEffectsEnabled;

  const showInTray =
    typeof record.showInTray === "boolean"
      ? record.showInTray
      : DEFAULT_SETTINGS.showInTray;

  const showInDock =
    typeof record.showInDock === "boolean"
      ? record.showInDock
      : DEFAULT_SETTINGS.showInDock;

  const openAtLogin =
    typeof record.openAtLogin === "boolean"
      ? record.openAtLogin
      : DEFAULT_SETTINGS.openAtLogin;

  const aiCleanup =
    typeof record.aiCleanup === "boolean"
      ? record.aiCleanup
      : DEFAULT_SETTINGS.aiCleanup;

  const aiModel =
    typeof record.aiModel === "string" &&
    record.aiModel.trim() &&
    AI_MODEL_OPTIONS.some((m) => m.id === record.aiModel)
      ? record.aiModel
      : DEFAULT_SETTINGS.aiModel;

  const shareTranscripts =
    typeof record.shareTranscripts === "boolean"
      ? record.shareTranscripts
      : DEFAULT_SETTINGS.shareTranscripts;

  const VALID_STYLES = new Set(["formal", "casual", "very-casual", "excited"]);

  const rawPrefs = record.stylePreferences as
    | Record<string, unknown>
    | undefined;
  const categories: AppCategory[] = [
    "personal",
    "work",
    "email",
    "code",
    "other",
  ];
  const stylePreferences = { ...DEFAULT_SETTINGS.stylePreferences };
  if (rawPrefs && typeof rawPrefs === "object") {
    for (const cat of categories) {
      if (
        typeof rawPrefs[cat] === "string" &&
        VALID_STYLES.has(rawPrefs[cat] as string)
      ) {
        stylePreferences[cat] = rawPrefs[cat] as WritingStyle;
      }
    }
  }
  // Migrate legacy single writingStyle → apply to all categories
  if (
    !rawPrefs &&
    typeof record.writingStyle === "string" &&
    VALID_STYLES.has(record.writingStyle)
  ) {
    for (const cat of categories) {
      stylePreferences[cat] = record.writingStyle as WritingStyle;
    }
  }

  const overlayDisplayId =
    typeof record.overlayDisplayId === "number"
      ? record.overlayDisplayId
      : null;

  const vibeCodeEnabled =
    typeof record.vibeCodeEnabled === "boolean"
      ? record.vibeCodeEnabled
      : DEFAULT_SETTINGS.vibeCodeEnabled;

  const autoFileDetection =
    typeof record.autoFileDetection === "boolean"
      ? record.autoFileDetection
      : typeof record.vibeCodeEnabled === "boolean"
        ? record.vibeCodeEnabled
        : DEFAULT_SETTINGS.autoFileDetection;

  const editorFileTagging =
    typeof record.editorFileTagging === "boolean"
      ? record.editorFileTagging
      : typeof record.cursorFileTagging === "boolean"
        ? record.cursorFileTagging
        : DEFAULT_SETTINGS.editorFileTagging;

  const toggleShortcutRaw = record.toggleShortcut as
    | Partial<GhostingShortcut>
    | undefined;
  const toggleShortcut =
    toggleShortcutRaw &&
    typeof toggleShortcutRaw.key === "string" &&
    typeof toggleShortcutRaw.keycode === "number" &&
    typeof toggleShortcutRaw.meta === "boolean" &&
    typeof toggleShortcutRaw.shift === "boolean" &&
    typeof toggleShortcutRaw.alt === "boolean" &&
    typeof toggleShortcutRaw.ctrl === "boolean"
      ? (toggleShortcutRaw as GhostingShortcut)
      : null;

  const autoDictionary =
    typeof record.autoDictionary === "boolean"
      ? record.autoDictionary
      : DEFAULT_SETTINGS.autoDictionary;

  // Keep at least one surface visible so the app can be reopened.
  const resolvedShowInTray = showInTray || !showInDock;
  const resolvedShowInDock = showInDock || !showInTray;

  return {
    autoPaste,
    shortcut,
    toggleShortcut,
    selectedMicrophone,
    transcriptionLanguage,
    transcriptionLanguages,
    soundEffectsEnabled,
    showInTray: resolvedShowInTray,
    showInDock: resolvedShowInDock,
    openAtLogin,
    aiCleanup,
    aiModel,
    shareTranscripts,
    stylePreferences,
    overlayDisplayId,
    vibeCodeEnabled,
    autoFileDetection,
    editorFileTagging,
    autoDictionary,
  };
}

function settingsPath() {
  return path.join(app.getPath("userData"), "ghostwriter.settings.json");
}

export async function loadSettings(): Promise<GhostwriterSettings> {
  try {
    const data = await fs.readFile(settingsPath(), "utf8");
    return coerceSettings(JSON.parse(data));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: GhostwriterSettings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2));
}

export async function updateSettings(
  current: GhostwriterSettings,
  patch: GhostwriterSettingsUpdate,
): Promise<GhostwriterSettings> {
  const nextShowInTray = patch.showInTray ?? current.showInTray;
  const nextShowInDock = patch.showInDock ?? current.showInDock;
  if (!nextShowInTray && !nextShowInDock) {
    throw new Error(
      "GhostWriter must be shown in the tray or dock so it can be reopened.",
    );
  }

  const requestedTranscriptionLanguage =
    patch.transcriptionLanguage ?? current.transcriptionLanguage;
  const normalizedTranscriptionLanguage =
    requestedTranscriptionLanguage === "auto"
      ? "auto"
      : normalizePrimaryLanguage(requestedTranscriptionLanguage);
  const fallbackSelectionLanguage =
    normalizedTranscriptionLanguage === "auto"
      ? (current.transcriptionLanguages[0] ??
        DEFAULT_TRANSCRIPTION_LANGUAGES[0])
      : normalizedTranscriptionLanguage;
  let nextTranscriptionLanguages = normalizeLanguageSelection(
    patch.transcriptionLanguages ?? current.transcriptionLanguages,
    fallbackSelectionLanguage,
  );
  if (
    normalizedTranscriptionLanguage !== "auto" &&
    !nextTranscriptionLanguages.includes(normalizedTranscriptionLanguage)
  ) {
    nextTranscriptionLanguages = normalizeLanguageSelection(
      [normalizedTranscriptionLanguage, ...nextTranscriptionLanguages],
      normalizedTranscriptionLanguage,
    );
  }

  const next: GhostwriterSettings = {
    autoPaste: patch.autoPaste ?? current.autoPaste,
    shortcut:
      patch.shortcut !== undefined
        ? patch.shortcut === null
          ? null
          : isResolvedShortcut(patch.shortcut)
            ? patch.shortcut
            : resolveShortcut(patch.shortcut)
        : current.shortcut,
    toggleShortcut:
      patch.toggleShortcut !== undefined
        ? patch.toggleShortcut === null
          ? null
          : isResolvedShortcut(patch.toggleShortcut)
            ? patch.toggleShortcut
            : resolveShortcut(patch.toggleShortcut)
        : current.toggleShortcut,
    selectedMicrophone:
      patch.selectedMicrophone !== undefined
        ? patch.selectedMicrophone
        : current.selectedMicrophone,
    transcriptionLanguage: normalizedTranscriptionLanguage,
    transcriptionLanguages: nextTranscriptionLanguages,
    soundEffectsEnabled:
      patch.soundEffectsEnabled ?? current.soundEffectsEnabled,
    showInTray: nextShowInTray,
    showInDock: nextShowInDock,
    openAtLogin: patch.openAtLogin ?? current.openAtLogin,
    aiCleanup: patch.aiCleanup ?? current.aiCleanup,
    aiModel: patch.aiModel ?? current.aiModel,
    shareTranscripts: patch.shareTranscripts ?? current.shareTranscripts,
    stylePreferences: {
      ...current.stylePreferences,
      ...patch.stylePreferences,
    },
    overlayDisplayId:
      patch.overlayDisplayId !== undefined
        ? patch.overlayDisplayId
        : current.overlayDisplayId,
    vibeCodeEnabled: patch.vibeCodeEnabled ?? current.vibeCodeEnabled,
    autoFileDetection: patch.autoFileDetection ?? current.autoFileDetection,
    editorFileTagging: patch.editorFileTagging ?? current.editorFileTagging,
    autoDictionary: patch.autoDictionary ?? current.autoDictionary,
  };

  await saveSettings(next);
  return next;
}

export function getDefaultSettings(): GhostwriterSettings {
  return DEFAULT_SETTINGS;
}
