import { clipboard } from "electron";
import { spawn } from "node:child_process";

type GhostedTextOptions = {
  autoPaste?: boolean;
  /**
   * When set, the paste function will create @-mention file tags
   * in Cursor's chat for any filenames found in the text.
   * Only used when the frontmost app is Cursor.
   */
  fileReferences?: string[];
  /** Bundle ID of the frontmost app at recording start. */
  bundleId?: string | null;
};

/** Cursor's bundle ID */
const CURSOR_BUNDLE_ID = "com.todesktop.230313mzl4w4u92";
/** VS Code's bundle ID */
const VSCODE_BUNDLE_ID = "com.microsoft.VSCode";

/** Bundle IDs that support file tagging in their chat */
const FILE_TAGGING_BUNDLE_IDS = new Set([CURSOR_BUNDLE_ID, VSCODE_BUNDLE_ID]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runAppleScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("osascript", ["-e", script]);
    proc.on("error", reject);
    proc.on("exit", () => resolve());
  });
}

/**
 * Split text around file references, producing alternating
 * plain-text and file-reference segments.
 *
 * Example:
 *   text = "Let's see if you can add the header.tsx file."
 *   fileRefs = ["header.tsx"]
 *   → [{ type: "text", value: "Let's see if you can add the " },
 *      { type: "file", value: "header.tsx" },
 *      { type: "text", value: " file." }]
 */
type TextSegment = { type: "text" | "file"; value: string };

function splitTextAroundFileRefs(
  text: string,
  fileRefs: string[],
): TextSegment[] {
  if (fileRefs.length === 0) return [{ type: "text", value: text }];

  // Build a regex that matches any of the file references (case-insensitive)
  // Sort by length descending so longer matches win (e.g. "auth.config.ts" before "config.ts")
  const sorted = [...fileRefs].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }
    // The file reference itself — use the original cased version from fileRefs
    const matchedText = match[1];
    const originalRef =
      sorted.find((f) => f.toLowerCase() === matchedText.toLowerCase()) ??
      matchedText;
    segments.push({ type: "file", value: originalRef });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

/**
 * Paste text into Cursor's chat with proper @-mention file tags.
 * Instead of a single clipboard paste, this:
 * 1. Pastes plain text segments via clipboard
 * 2. For file references: types `@`, waits for dropdown, types the filename,
 *    waits, then presses Enter to select from autocomplete
 */
async function pasteWithCursorFileTags(
  text: string,
  fileRefs: string[],
): Promise<void> {
  const segments = splitTextAroundFileRefs(text, fileRefs);

  // If no file references were found in the output, fall back to simple paste
  const hasFileSegment = segments.some((s) => s.type === "file");
  if (!hasFileSegment) {
    clipboard.writeText(text);
    await delay(40);
    await runAppleScript(
      'tell application "System Events" to keystroke "v" using command down',
    );
    return;
  }

  for (const segment of segments) {
    if (segment.type === "text" && segment.value) {
      // Paste plain text via clipboard
      clipboard.writeText(segment.value);
      await delay(40);
      await runAppleScript(
        'tell application "System Events" to keystroke "v" using command down',
      );
      await delay(60);
    } else if (segment.type === "file") {
      // Type @ to trigger Cursor's file picker dropdown
      await runAppleScript('tell application "System Events" to keystroke "@"');
      await delay(300); // Wait for dropdown to appear

      // Type the filename to filter the dropdown
      // Use clipboard paste for reliability (special characters, speed)
      clipboard.writeText(segment.value);
      await delay(30);
      await runAppleScript(
        'tell application "System Events" to keystroke "v" using command down',
      );
      await delay(400); // Wait for autocomplete to filter

      // Press Enter to select the first (best) match
      await runAppleScript(
        'tell application "System Events" to key code 36', // 36 = Return
      );
      await delay(100);
    }
  }
}

/**
 * Paste text into VS Code Copilot Chat with proper #file tags.
 *
 * Sequence:  type `#` → category picker appears → type `file:` to select
 * the #file category → file picker opens → paste filename → Tab to accept.
 * (Enter submits the chat message, so we must use Tab to accept selections.)
 */
async function pasteWithVSCodeFileTags(
  text: string,
  fileRefs: string[],
): Promise<void> {
  const segments = splitTextAroundFileRefs(text, fileRefs);

  const hasFileSegment = segments.some((s) => s.type === "file");
  if (!hasFileSegment) {
    clipboard.writeText(text);
    await delay(40);
    await runAppleScript(
      'tell application "System Events" to keystroke "v" using command down',
    );
    return;
  }

  for (const segment of segments) {
    if (segment.type === "text" && segment.value) {
      clipboard.writeText(segment.value);
      await delay(40);
      await runAppleScript(
        'tell application "System Events" to keystroke "v" using command down',
      );
      await delay(60);
    } else if (segment.type === "file") {
      // Type # to trigger VS Code's context picker
      await runAppleScript('tell application "System Events" to keystroke "#"');
      await delay(400); // Wait for picker to appear

      // Type the filename using keystrokes (not clipboard paste) so the
      // picker properly filters and focuses the matched item.
      const escaped = segment.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      await runAppleScript(
        `tell application "System Events" to keystroke "${escaped}"`,
      );
      await delay(600); // Wait for picker to filter and highlight

      // Press Tab to accept the highlighted file
      await runAppleScript(
        'tell application "System Events" to key code 48', // 48 = Tab
      );
      await delay(150);
    }
  }
}

export async function applyGhostedText(
  text: string,
  options: GhostedTextOptions = {},
): Promise<void> {
  const { autoPaste, fileReferences, bundleId } = options;

  if (autoPaste === false) {
    clipboard.writeText(text);
    return;
  }

  // If we have file references and we're in a supported editor, use file tagging
  if (
    fileReferences &&
    fileReferences.length > 0 &&
    bundleId &&
    FILE_TAGGING_BUNDLE_IDS.has(bundleId)
  ) {
    if (bundleId === CURSOR_BUNDLE_ID) {
      await pasteWithCursorFileTags(text, fileReferences);
      return;
    }

    if (bundleId === VSCODE_BUNDLE_ID) {
      await pasteWithVSCodeFileTags(text, fileReferences);
      return;
    }
  }

  // Default: simple clipboard paste
  clipboard.writeText(text);
  await delay(40);
  await runAppleScript(
    'tell application "System Events" to keystroke "v" using command down',
  );
}
