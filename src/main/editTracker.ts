import { spawn } from "node:child_process";
import { addDictionaryEntry, loadDictionary } from "./dictionaryStore";

/**
 * Edit Tracker — auto-dictionary learning.
 *
 * After GhostWriter pastes cleaned text, the user may immediately edit a word
 * or two (e.g., correcting a name the AI got wrong).  This module detects
 * those corrections by re-reading the text from the active application after
 * a period of keyboard inactivity and diffing it against the original paste.
 *
 * Detected word substitutions are automatically added to the dictionary as
 * corrections so the AI gets them right next time.
 *
 * How it works (macOS):
 * 1.  After the paste, we record the original cleaned text.
 * 2.  We monitor keyboard activity via uiohook.  Each keystroke resets an
 *     idle timer.  Once the user stops typing for IDLE_TIMEOUT_MS (7.5 s),
 *     we read the text.  A hard cap of MAX_WAIT_MS (90 s) ensures we
 *     eventually check even if the user keeps typing.
 * 3.  We use inline JXA (JavaScript for Automation) piped to `osascript` via
 *     stdin.  `osascript` inherits the parent app's macOS Accessibility
 *     trust, so AX API calls work without extra permissions.  The script
 *     walks the AX element tree (BFS) to find text content even in Electron /
 *     Chromium apps like VS Code — completely invisible, no Cmd+A / Cmd+C.
 * 4.  We locate the (possibly edited) region inside the retrieved text using
 *     a fuzzy search and run a word-level diff.
 * 5.  Substituted words whose Levenshtein distance is within a threshold are
 *     added to the local dictionary as `isCorrection: true` entries.
 */

// ── Configuration ───────────────────────────────────────────────────────────

/** How long the user must be idle (no keystrokes) before we check. */
const IDLE_TIMEOUT_MS = 7_500;
/** Hard cap — check no matter what after this long. */
const MAX_WAIT_MS = 90_000;

// ── Inline JXA for macOS Accessibility API ──────────────────────────────────

/**
 * Build a JXA script that reads text from the focused element using the
 * macOS Accessibility API via the JXA Application scripting bridge.
 *
 * ⚠  We deliberately use `Application("System Events")` and the JXA
 * scripting bridge instead of the raw ObjC bridge (`$.AXUIElementCopy…`).
 * The ObjC bridge has a fundamental type-bridging bug: `Ref()[0]` returns
 * an untyped `CFTypeRef` that JXA cannot pass back into subsequent AX
 * calls, causing "Ref has incompatible type (-2700)" errors.  The
 * Application scripting bridge dispatches via AppleEvents, which handles
 * AX element types correctly.
 *
 * Commands:
 *   value              → read full AXValue from focused text element
 *   range <off> <len>  → read substring (AXValue fallback + JS substring)
 *   cursor             → get cursor position (character offset)
 */
function buildAxScript(command: string, args: string[] = []): string {
  const escapedArgs = args.map((a) => JSON.stringify(a));
  return `
var _cmd = ${JSON.stringify(command)};
var _args = [${escapedArgs.join(", ")}];

// ── Resolve focused text element ──────────────────────────────────────
// Uses JXA Application scripting bridge (NOT ObjC bridge) so AX element
// references are correctly typed across calls.

var se = Application("System Events");
var procs = se.processes.whose({ frontmost: true });
if (procs.length === 0) {
  "AX_ERROR: no frontmost process";
} else {
  var proc = procs[0];
  var focElem = null;
  try {
    focElem = proc.attributes.byName("AXFocusedUIElement").value();
  } catch (e) {}

  if (focElem === null) {
    "AX_ERROR: could not find text element";
  } else {
    // ── Helper: read value from element, with deep search fallback ──
    function readValue(el) {
      var v = null;
      try { v = el.value(); } catch (e) {}
      if (v !== null && v !== undefined && ("" + v).length > 0) return "" + v;

      // Deep search: only for roles likely to contain nested text elements.
      // Avoid entireContents() on complex views (e.g. terminal web area)
      // as it can enumerate thousands of elements and time out.
      var role = "";
      try { role = el.attributes.byName("AXRole").value(); } catch (e) {}
      var deepRoles = ["AXGroup","AXScrollArea","AXSplitGroup","AXLayoutArea"];
      if (deepRoles.indexOf(role) === -1) return null;

      try {
        var all = el.entireContents();
        var limit = Math.min(all.length, 100);
        for (var i = 0; i < limit; i++) {
          try {
            var cv = all[i].value();
            if (cv !== null && cv !== undefined && ("" + cv).length > 0) return "" + cv;
          } catch (e2) {}
        }
      } catch (e3) {}
      return null;
    }

    if (_cmd === "value") {
      var val = readValue(focElem);
      if (val === null) "AX_ERROR: element has no AXValue";
      else val;

    } else if (_cmd === "range") {
      var off = parseInt(_args[0], 10);
      var len = parseInt(_args[1], 10);
      var full = readValue(focElem);
      if (full === null) "AX_ERROR: could not read text";
      else {
        var s = Math.min(off, full.length);
        var e = Math.min(off + len, full.length);
        full.substring(s, e);
      }

    } else if (_cmd === "cursor") {
      try {
        var range = focElem.attributes.byName("AXSelectedTextRange").value();
        "" + range[0]; // range is [location, length]; we return location
      } catch (e) {
        "AX_ERROR: could not read cursor position";
      }

    } else {
      "AX_ERROR: unknown command: " + _cmd;
    }
  }
}
`;
}

/**
 * Run a JXA script via osascript using stdin pipe.
 * `osascript` inherits the parent process's Accessibility trust, so the AX
 * API calls work without needing separate binary permissions.
 */
function runAxReader(command: string, ...args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const script = buildAxScript(command, args);
    const proc = spawn("osascript", ["-l", "JavaScript"], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5_000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      const out = stdout.trim();
      if (code !== 0 || out.startsWith("AX_ERROR:")) {
        return reject(
          new Error(out || stderr.trim() || `osascript exited ${code}`),
        );
      }
      resolve(out);
    });

    // Write the script to stdin and close
    proc.stdin.write(script);
    proc.stdin.end();
  });
}

// ── Word-level diff utilities ───────────────────────────────────────────────

/** Normalise text for comparison (lowercase, collapse whitespace). */
function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Tokenise into words, stripping leading/trailing punctuation from each. */
function tokenise(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter(Boolean);
}

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

/**
 * Compute word-level diff using LCS (Longest Common Subsequence).
 * Returns pairs of (original, replacement) for substituted words.
 */
export type WordCorrection = {
  original: string;
  replacement: string;
};

function wordDiff(
  originalWords: string[],
  editedWords: string[],
): WordCorrection[] {
  const m = originalWords.length;
  const n = editedWords.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (
        originalWords[i - 1].toLowerCase() === editedWords[j - 1].toLowerCase()
      ) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the diff operations
  const corrections: WordCorrection[] = [];
  let i = m;
  let j = n;

  // Collect delete/insert operations, then match them as substitutions
  const deletions: { index: number; word: string }[] = [];
  const insertions: { index: number; word: string }[] = [];

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      originalWords[i - 1].toLowerCase() === editedWords[j - 1].toLowerCase()
    ) {
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      insertions.push({ index: j - 1, word: editedWords[j - 1] });
      j--;
    } else {
      deletions.push({ index: i - 1, word: originalWords[i - 1] });
      i--;
    }
  }

  // Try to pair up adjacent deletions and insertions as substitutions.
  // A deletion at position i paired with an insertion at position j
  // likely means the user replaced one word with another.

  // ── Handle word-merges first ──────────────────────────────────────────
  // When the user deletes a space to combine two words ("front end" →
  // "frontend"), we see consecutive deletions and a single insertion whose
  // text equals the concatenation.  Detect & record those before the
  // single-word pairing pass so they aren't partially matched.

  // Sort deletions by position so consecutive ones are adjacent in array
  deletions.sort((a, b) => a.index - b.index);
  insertions.sort((a, b) => a.index - b.index);

  // Group consecutive deletions (indices differ by 1)
  const delGroups: (typeof deletions)[] = [];
  for (const del of deletions) {
    const last = delGroups[delGroups.length - 1];
    if (last && del.index === last[last.length - 1].index + 1) {
      last.push(del);
    } else {
      delGroups.push([del]);
    }
  }

  // For each group of ≥2 consecutive deletions, check if their
  // concatenation matches any unused insertion.
  for (const group of delGroups) {
    if (group.length < 2) continue;
    const concat = group.map((d) => d.word).join("");
    for (const ins of insertions) {
      if ((ins as { used?: boolean }).used) continue;
      if (concat.toLowerCase() === ins.word.toLowerCase()) {
        corrections.push({
          original: group.map((d) => d.word).join(" "),
          replacement: ins.word,
        });
        (ins as { used?: boolean }).used = true;
        for (const d of group) (d as { used?: boolean }).used = true;
        break;
      }
    }
  }

  // Similarly check if a single insertion is a near-match of concatenated
  // consecutive deletions (e.g. "back end" → "backend" with slight typo).
  for (const group of delGroups) {
    if (group.length < 2) continue;
    if (group.some((d) => (d as { used?: boolean }).used)) continue;
    const concat = group.map((d) => d.word).join("");
    for (const ins of insertions) {
      if ((ins as { used?: boolean }).used) continue;
      const lev = levenshtein(concat.toLowerCase(), ins.word.toLowerCase());
      const maxLen = Math.max(concat.length, ins.word.length);
      if (lev <= Math.ceil(maxLen * 0.3)) {
        // Very close match
        corrections.push({
          original: group.map((d) => d.word).join(" "),
          replacement: ins.word,
        });
        (ins as { used?: boolean }).used = true;
        for (const d of group) (d as { used?: boolean }).used = true;
        break;
      }
    }
  }

  // ── Single-word substitutions ─────────────────────────────────────────

  for (const del of deletions) {
    if ((del as { used?: boolean }).used) continue;
    // Find the closest insertion that hasn't been used
    let bestIns: (typeof insertions)[number] | null = null;
    let bestDist = Infinity;
    for (const ins of insertions) {
      if ((ins as { used?: boolean }).used) continue;
      const dist = Math.abs(del.index - ins.index);
      if (dist < bestDist) {
        bestDist = dist;
        bestIns = ins;
      }
    }

    if (bestIns && bestDist <= 2) {
      // This looks like a substitution — check Levenshtein similarity
      const lev = levenshtein(
        del.word.toLowerCase(),
        bestIns.word.toLowerCase(),
      );
      const maxLen = Math.max(del.word.length, bestIns.word.length);
      const minLen = Math.min(del.word.length, bestIns.word.length);

      // Length-ratio gate: if one word is less than half the length of the
      // other they are almost certainly different words entirely (e.g.
      // "liberate" → "live") rather than a phonetic correction.
      const lengthRatio = minLen / maxLen;

      // Accept if:
      //   – the words are similar length (ratio ≥ 0.5) AND
      //   – the edit distance is at most 50 % of the longer word
      // OR the words are very short (≤ 3 chars) where distance thresholds
      //    are unreliable.
      if (
        (lengthRatio >= 0.5 && lev <= Math.ceil(maxLen * 0.5)) ||
        maxLen <= 3
      ) {
        corrections.push({
          original: del.word,
          replacement: bestIns.word,
        });
        (bestIns as { used?: boolean }).used = true;
      }
    }
  }

  // Filter out alignment artifacts: corrections where one word is a
  // prefix/suffix of the other (e.g. "Let's" → "et's" from an off-by-one
  // read).  Real corrections change the *content*, not just trim edges.
  return corrections.filter((c) => {
    const lo = c.original.toLowerCase();
    const lr = c.replacement.toLowerCase();
    if (lo.includes(lr) || lr.includes(lo)) return false;

    // Reject corrections involving very common English stop-words as the
    // original — these are almost always alignment noise, not genuine
    // phonetic corrections a user would make.
    const STOP_WORDS = new Set([
      "a",
      "an",
      "the",
      "is",
      "it",
      "in",
      "on",
      "at",
      "to",
      "of",
      "or",
      "and",
      "be",
      "for",
      "not",
      "no",
      "do",
      "if",
      "so",
      "we",
      "he",
      "me",
      "my",
      "by",
      "up",
      "am",
      "as",
      "us",
      "add",
      "all",
      "but",
      "can",
      "did",
      "get",
      "got",
      "had",
      "has",
      "her",
      "him",
      "his",
      "how",
      "its",
      "let",
      "may",
      "new",
      "now",
      "old",
      "our",
      "out",
      "own",
      "put",
      "run",
      "say",
      "she",
      "too",
      "try",
      "use",
      "was",
      "way",
      "who",
      "why",
      "yet",
      "you",
    ]);
    if (STOP_WORDS.has(lo)) return false;

    // Reject corrections where both words are very short (≤ 2 chars) —
    // too noisy and never meaningful corrections.
    if (lo.length <= 2 && lr.length <= 2) return false;

    return true;
  });
}

/**
 * Try to locate the pasted text region inside a larger body of text.
 * Returns the best-matching substring, or null if no good match.
 */
function findPastedRegion(
  fullText: string,
  originalPaste: string,
): string | null {
  const normFull = normalise(fullText);
  const normPaste = normalise(originalPaste);

  // Exact substring match (after normalisation)
  if (normFull === normPaste) return fullText.trim();

  // If the full text contains the original paste verbatim, user didn't edit
  if (normFull.includes(normPaste)) return null; // no edits detected

  // Try to find the best matching window in the full text.
  // Use the original paste's word count to estimate the window size.
  const pasteWords = tokenise(originalPaste);
  const fullWords = tokenise(fullText);

  if (fullWords.length === 0 || pasteWords.length === 0) return null;

  // If full text is similar length to paste (±30%), compare directly
  if (
    fullWords.length <= pasteWords.length * 1.3 &&
    fullWords.length >= pasteWords.length * 0.7
  ) {
    return fullText.trim();
  }

  // For larger texts, find the window with the most word overlap
  const windowSize = pasteWords.length;
  const pasteSet = new Set(pasteWords.map((w) => w.toLowerCase()));
  let bestStart = 0;
  let bestScore = 0;

  for (let start = 0; start <= fullWords.length - windowSize; start++) {
    let score = 0;
    for (let k = 0; k < windowSize; k++) {
      if (pasteSet.has(fullWords[start + k].toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  // Require at least 50% word overlap to consider it a match
  if (bestScore < windowSize * 0.5) return null;

  return fullWords.slice(bestStart, bestStart + windowSize).join(" ");
}

// ── Tracker state ───────────────────────────────────────────────────────────

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let maxTimer: ReturnType<typeof setTimeout> | null = null;
let lastPastedText: string | null = null;
let pasteCharOffset: number | null = null; // character offset where paste starts
let isTracking = false;

export type AutoDictionaryCallback = (corrections: WordCorrection[]) => void;

let onCorrectionsDetected: AutoDictionaryCallback | null = null;

export function setOnCorrectionsDetected(cb: AutoDictionaryCallback | null) {
  onCorrectionsDetected = cb;
}

/** Reset the idle countdown (called on every keystroke while tracking). */
function resetIdleTimer() {
  if (!isTracking) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    teardownTracking();
    void checkForCorrections();
  }, IDLE_TIMEOUT_MS);
}

/**
 * Call this on every keystroke from the main process (wired up via uiohook
 * in main.ts).  Resets the idle timer so we wait for the user to finish
 * editing before checking for corrections.
 */
export function notifyKeystroke() {
  resetIdleTimer();
}

/** Clean up all timers. */
function teardownTracking() {
  isTracking = false;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (maxTimer) {
    clearTimeout(maxTimer);
    maxTimer = null;
  }
}

/**
 * Use the AX reader to get the current cursor position.
 * Returns the character offset (0-based), or null if it can't be determined.
 *
 * Note: The JXA scripting bridge returns 1-based positions (AppleScript
 * convention), so we subtract 1 to convert to 0-based for JS substring().
 */
async function getCursorPosition(): Promise<number | null> {
  try {
    const out = await runAxReader("cursor");
    const pos = parseInt(out, 10);
    if (!Number.isFinite(pos)) return null;
    // Convert from 1-based (scripting bridge) to 0-based (JS)
    return Math.max(0, pos - 1);
  } catch {
    return null;
  }
}

/**
 * Begin tracking after a successful paste.
 * Records the paste position via AX, then monitors keyboard activity and
 * waits for the user to stop typing before checking for corrections.
 */
export function startTracking(pastedText: string) {
  // Cancel any previous pending check
  teardownTracking();
  lastPastedText = pastedText;
  pasteCharOffset = null;
  isTracking = true;

  // Grab cursor position (fire-and-forget — non-blocking).
  // Right after a paste the cursor sits at the END of the pasted text.
  getCursorPosition()
    .then((pos) => {
      if (pos !== null) {
        pasteCharOffset = Math.max(0, pos - pastedText.length);
      }
    })
    .catch(() => {});

  // Start idle timer — if no keystrokes at all, fires after IDLE_TIMEOUT_MS
  resetIdleTimer();

  // Hard cap: force a check after MAX_WAIT_MS no matter what
  maxTimer = setTimeout(() => {
    teardownTracking();
    void checkForCorrections();
  }, MAX_WAIT_MS);
}

/** Cancel any pending correction check (e.g. when a new session starts). */
export function cancelTracking() {
  teardownTracking();
  lastPastedText = null;
  pasteCharOffset = null;
}

// ── Core logic ──────────────────────────────────────────────────────────────

/**
 * Read **only** the pasted region from the frontmost app via the macOS
 * Accessibility API.  Completely invisible — no clipboard, no Cmd+A flash.
 *
 * Strategy:
 * 1.  If we have a known paste offset, read a targeted range via AXValue +
 *     JS substring.
 * 2.  Otherwise, read the full AXValue.
 *
 * The `offset` / `length` refer to the *original* paste position and
 * character count.  We add a 40 % buffer to `length` because the user
 * may have typed extra characters.
 */
async function readPastedRegion(
  offset: number | null,
  originalLength: number,
): Promise<string | null> {
  const windowLen = Math.ceil(originalLength * 1.4);

  // ── 1. Targeted range read (invisible, precise) ───────────────────────
  if (offset !== null) {
    try {
      const text = await runAxReader(
        "range",
        String(offset),
        String(windowLen),
      );
      if (text && text.trim() !== "") {
        return text;
      }
    } catch {
      // AX range read not available, fall through to full value read
    }
  }

  // ── 2. Full value read (invisible) ────────────────────────────────────
  try {
    const fullText = await runAxReader("value");
    if (fullText && fullText.trim() !== "") {
      if (offset !== null) {
        return fullText.substring(offset, offset + windowLen);
      }
      return fullText;
    }
  } catch {
    // AX value read not available
  }

  return null;
}

async function checkForCorrections() {
  if (!lastPastedText) return;

  const originalPaste = lastPastedText;
  const offset = pasteCharOffset;
  lastPastedText = null;
  pasteCharOffset = null;

  const region = await readPastedRegion(offset, originalPaste.length);
  if (!region) {
    return;
  }

  // If we had an offset we already sliced to the right region; compare
  // directly.  If not, try to locate the paste inside the full text.
  let editedRegion: string | null;
  if (offset !== null) {
    // We already have a targeted slice — use it directly.
    // Quick sanity check: if the normalised text is identical the user
    // didn't change anything.
    if (normalise(region) === normalise(originalPaste)) {
      return;
    }

    // ── Similarity gate ─────────────────────────────────────────────
    // If the user switched focus (e.g. sent a chat message, clicked into
    // another editor), the AX reader will return text from a completely
    // unrelated element.  Bail out if the read text doesn't resemble the
    // original paste.
    const readWords = tokenise(region);
    const origWords = tokenise(originalPaste);
    const origSet = new Set(origWords.map((w) => w.toLowerCase()));
    let overlap = 0;
    for (const w of readWords) {
      if (origSet.has(w.toLowerCase())) overlap++;
    }
    const overlapRatio = origWords.length > 0 ? overlap / origWords.length : 0;
    if (overlapRatio < 0.5) {
      return;
    }

    editedRegion = region;
  } else {
    editedRegion = findPastedRegion(region, originalPaste);
  }

  if (!editedRegion) {
    return;
  }

  // Tokenise and diff
  const originalWords = tokenise(originalPaste);
  const editedWords = tokenise(editedRegion);

  const corrections = wordDiff(originalWords, editedWords);

  if (corrections.length === 0) {
    return;
  }

  console.log("[editTracker] corrections detected:", corrections);

  // Filter out corrections that already exist in the dictionary
  const existingDictionary = await loadDictionary();
  const existingCorrections = new Set(
    existingDictionary
      .filter((e) => e.isCorrection && e.misspelling)
      .map((e) => `${e.misspelling!.toLowerCase()}→${e.word.toLowerCase()}`),
  );

  const newCorrections = corrections.filter(
    (c) =>
      !existingCorrections.has(
        `${c.original.toLowerCase()}→${c.replacement.toLowerCase()}`,
      ),
  );

  if (newCorrections.length === 0) {
    return;
  }

  // Add corrections to dictionary
  for (const correction of newCorrections) {
    await addDictionaryEntry({
      word: correction.replacement,
      isCorrection: true,
      misspelling: correction.original,
    });
    console.log(
      `[editTracker] auto-added correction: "${correction.original}" → "${correction.replacement}"`,
    );
  }

  // Notify listeners
  onCorrectionsDetected?.(newCorrections);
}
