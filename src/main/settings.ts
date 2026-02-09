import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { UiohookKey } from "uiohook-napi";

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

export type GhosttypeSettings = {
  autoPaste: boolean;
  shortcut: GhostingShortcut;
};

export type GhosttypeSettingsUpdate = {
  autoPaste?: boolean;
  shortcut?: GhostingShortcutInput | GhostingShortcut;
};

const DEFAULT_SETTINGS: GhosttypeSettings = {
  autoPaste: true,
  shortcut: {
    key: "Space",
    keycode: UiohookKey.Space,
    meta: true,
    shift: true,
    alt: false,
    ctrl: false
  }
};

const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight"
]);

const MODIFIER_KEYCODES: Set<number> = new Set([
  UiohookKey.Meta,
  UiohookKey.MetaRight,
  UiohookKey.Shift,
  UiohookKey.ShiftRight,
  UiohookKey.Alt,
  UiohookKey.AltRight,
  UiohookKey.Ctrl,
  UiohookKey.CtrlRight
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
  Slash: { key: "/", keycode: UiohookKey.Slash }
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
  "9": (UiohookKey as Record<string, number>)["9"]
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
  [UiohookKey.Slash]: "/"
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
    ctrl: input.ctrl
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

  const hasModifier = modifiers.meta || modifiers.shift || modifiers.alt || modifiers.ctrl;
  if (!hasModifier && resolved.key.length === 1) {
    throw new Error("Add at least one modifier (Cmd, Ctrl, Opt, Shift).");
  }

  return {
    key: resolved.key,
    keycode: resolved.keycode,
    ...modifiers
  };
}

function isResolvedShortcut(
  shortcut: GhostingShortcutInput | GhostingShortcut
): shortcut is GhostingShortcut {
  return (shortcut as GhostingShortcut).keycode !== undefined;
}

export function isModifierKeycode(keycode: number) {
  return MODIFIER_KEYCODES.has(keycode);
}

export function formatShortcutPreview(
  modifiers: { meta: boolean; shift: boolean; alt: boolean; ctrl: boolean },
  key?: string
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
  modifiers: { meta: boolean; shift: boolean; alt: boolean; ctrl: boolean }
): GhostingShortcut {
  if (isModifierKeycode(keycode)) {
    throw new Error("Choose a non-modifier key for the shortcut.");
  }

  const key = KEYCODE_LABELS[keycode];
  if (!key) {
    throw new Error("Unsupported key. Use letters, numbers, or common keys.");
  }

  const hasModifier = modifiers.meta || modifiers.shift || modifiers.alt || modifiers.ctrl;
  if (!hasModifier && key.length === 1) {
    throw new Error("Add at least one modifier (Cmd, Ctrl, Opt, Shift).");
  }

  return {
    key,
    keycode,
    ...modifiers
  };
}

function coerceSettings(raw: unknown): GhosttypeSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const record = raw as Record<string, unknown>;

  const autoPaste =
    typeof record.autoPaste === "boolean" ? record.autoPaste : DEFAULT_SETTINGS.autoPaste;

  const shortcutRaw = record.shortcut as Partial<GhostingShortcut> | undefined;
  const shortcut = shortcutRaw &&
    typeof shortcutRaw.key === "string" &&
    typeof shortcutRaw.keycode === "number" &&
    typeof shortcutRaw.meta === "boolean" &&
    typeof shortcutRaw.shift === "boolean" &&
    typeof shortcutRaw.alt === "boolean" &&
    typeof shortcutRaw.ctrl === "boolean"
      ? (shortcutRaw as GhostingShortcut)
      : DEFAULT_SETTINGS.shortcut;

  return { autoPaste, shortcut };
}

function settingsPath() {
  return path.join(app.getPath("userData"), "ghosttype.settings.json");
}

export async function loadSettings(): Promise<GhosttypeSettings> {
  try {
    const data = await fs.readFile(settingsPath(), "utf8");
    return coerceSettings(JSON.parse(data));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: GhosttypeSettings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2));
}

export async function updateSettings(
  current: GhosttypeSettings,
  patch: GhosttypeSettingsUpdate
): Promise<GhosttypeSettings> {
  const next: GhosttypeSettings = {
    autoPaste: patch.autoPaste ?? current.autoPaste,
    shortcut: patch.shortcut
      ? isResolvedShortcut(patch.shortcut)
        ? patch.shortcut
        : resolveShortcut(patch.shortcut)
      : current.shortcut
  };

  await saveSettings(next);
  return next;
}

export function getDefaultSettings(): GhosttypeSettings {
  return DEFAULT_SETTINGS;
}
