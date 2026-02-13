import fs from "node:fs/promises";
import { cleanupGhostedText, type TokenUsageInfo } from "./aiGateway";
import {
  categoryFromBundleId,
  getFrontmostBundleId,
  nameFromBundleId,
  type AppCategory,
} from "./appCategory";
import {
  getDefaultInputDeviceName,
  invalidateDefaultDeviceCache,
  startRecording,
  stopRecording,
  type RecordingSession,
} from "./audio";
import { loadDictionary } from "./dictionaryStore";
import {
  detectActiveEditorContext,
  extractFileReferences,
  resolveSpokenFileReferences,
} from "./editorContext";
import { applyGhostedText } from "./paste";
import type { GhostwriterSettings } from "./settings";
import { loadSnippets } from "./snippetStore";
import { readVibeCodeFileContents } from "./vibeCodeStore";
import { transcribeWithWhisper } from "./whisper";

/**
 * Whisper.cpp sometimes transcribes background noise, silence, or
 * non-speech audio as bracketed/parenthesised markers such as
 * `[silence]`, `(clicking)`, `[BLANK_AUDIO]`, `[music]`, etc.
 *
 * `stripNoiseMarkers` removes these bracket/paren tokens and returns
 * the remaining text (empty string if nothing is left).
 *
 * Whisper also hallucinates short stock phrases ("Thank you",
 * "Merci", "Danke", etc.) when the audio is mostly silence.
 * The primary defence is an **audio-energy gate** in `stopGhosting`:
 * after recording stops, we read the WAV file and compute its peak
 * RMS energy — if it never exceeded a speech threshold we skip
 * transcription entirely (language-agnostic, duration-agnostic).
 * `isLikelyHallucination` is a secondary backup that catches edge
 * cases via word-rate analysis.
 */

function stripNoiseMarkers(text: string): string {
  // Remove any [...] or (...) tokens that Whisper uses for non-speech
  // events.  Common examples: [silence], [BLANK_AUDIO], (clicking),
  // [music], (footsteps), [laughter], (sighs), [noise], etc.
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Secondary heuristic: detects whether a short transcription is likely a
 * Whisper hallucination based on word-rate.  The primary guard is the
 * audio-energy gate in stopGhosting (which reads the WAV file and skips
 * transcription entirely when no speech energy was detected).  This
 * function acts as a backup for edge cases where background noise was
 * loud enough to pass the energy threshold but Whisper still hallucinated.
 *
 * Works across ALL languages — real speech runs at ~2–3 words/sec;
 * a handful of words well below that rate from a long-ish recording
 * means the audio was mostly noise.
 */
function isLikelyHallucination(text: string, durationMs: number): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  // Don't apply word-rate heuristic to short recordings — a quick tap
  // with a single word is legitimate and the low word count is expected.
  if (durationMs < 1500) return false;

  const wordsPerSecond = words.length / (durationMs / 1000);

  // ≤ 4 words at under 1.5 words/sec from a 1.5 s+ recording →
  // almost certainly a hallucination.
  if (words.length <= 4 && wordsPerSecond < 1.5) return true;

  return false;
}

/**
 * Read a 16-bit PCM WAV file and check whether it contains sustained
 * speech energy — not just a brief transient like a keyboard click.
 *
 * Computes RMS energy over 50 ms sliding windows and counts how many
 * windows exceed a speech threshold.  Real speech produces sustained
 * energy across many consecutive windows (a single spoken word is
 * typically 200–500 ms = 4–10 windows).  A keyboard click or tap
 * produces a sharp transient in at most 1–2 windows.
 *
 * Returns `true` if the audio likely contains speech, `false` if it's
 * just silence / ambient noise / key clicks.
 *
 * The WAV is expected to be mono 16 kHz s16le (the format we record).
 */
async function wavContainsSpeech(filePath: string): Promise<boolean> {
  const WINDOW_SAMPLES = 800; // 50 ms at 16 kHz
  const WAV_HEADER_BYTES = 44;
  // RMS threshold per window — above typical ambient / mic self-noise
  // but reachable by even quiet speech.
  const WINDOW_ENERGY_THRESHOLD = 0.015;
  // Minimum number of windows that must exceed the threshold.
  // 3 windows × 50 ms = 150 ms of sustained energy — enough to
  // confirm a spoken syllable while rejecting brief click transients.
  const MIN_SPEECH_WINDOWS = 3;

  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    return false;
  }

  const pcm = buf.subarray(WAV_HEADER_BYTES);
  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount === 0) return false;

  let speechWindows = 0;

  for (let start = 0; start < sampleCount; start += WINDOW_SAMPLES) {
    const end = Math.min(start + WINDOW_SAMPLES, sampleCount);
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      const sample = pcm.readInt16LE(i * 2);
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / (end - start)) / 32768;
    if (rms >= WINDOW_ENERGY_THRESHOLD) speechWindows++;

    // Early exit — once we have enough speech windows, no need to
    // scan the rest of the file.
    if (speechWindows >= MIN_SPEECH_WINDOWS) return true;
  }

  return false;
}

export type GhostingPhase = "idle" | "recording" | "cleaning" | "error";

export type GhostingState = {
  phase: GhostingPhase;
  lastGhostedText: string;
  lastRawText: string;
  error: string | null;
};

export class GhostingController {
  private recordingSession: RecordingSession | null = null;
  private recordingStartTime: number | null = null;
  private recordingAppCategory: AppCategory = "other";
  private recordingAppName: string = "Unknown";
  private recordingBundleId: string | null = null;
  private pendingStop = false;
  private state: GhostingState = {
    phase: "idle",
    lastGhostedText: "",
    lastRawText: "",
    error: null,
  };

  constructor(
    private readonly onState: (state: GhostingState) => void,
    private readonly getSettings: () => GhostwriterSettings,
    private readonly onSessionComplete?: (session: {
      wordCount: number;
      durationMs: number;
      rawLength: number;
      cleanedLength: number;
      rawText: string;
      cleanedText: string;
      appName: string;
      tokenUsage?: TokenUsageInfo;
    }) => void,
    private readonly onMicLevel?: (level: number) => void,
  ) {}

  getState() {
    return this.state;
  }

  private setState(patch: Partial<GhostingState>) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }

  async startGhosting() {
    if (this.state.phase === "recording" || this.state.phase === "cleaning") {
      return;
    }

    this.pendingStop = false;

    // When the user hasn't picked a specific mic, resolve the real macOS
    // default input device (cached, fast) instead of blindly using index 0.
    // Invalidate cache first so we always track the current macOS setting.
    const configured = this.getSettings().selectedMicrophone ?? null;
    if (!configured) invalidateDefaultDeviceCache();
    const selectedMic = configured ?? (await getDefaultInputDeviceName());

    try {
      const session = startRecording(selectedMic, (level) => {
        this.onMicLevel?.(level);
      });
      this.recordingSession = session;
      this.recordingStartTime = Date.now();

      // Show the recording overlay immediately so the user gets instant
      // visual feedback.  The app-detection calls below use execSync +
      // osascript which can take several hundred milliseconds each.
      this.setState({ phase: "recording", error: null });

      // Detect the frontmost app *once* and derive category + name from
      // the single result instead of spawning osascript three times.
      const bundleId = getFrontmostBundleId();
      this.recordingBundleId = bundleId;
      this.recordingAppCategory = categoryFromBundleId(bundleId);
      this.recordingAppName = nameFromBundleId(bundleId);

      session.process.once("error", (error) => {
        this.recordingSession = null;
        this.onMicLevel?.(0);
        this.setState({ phase: "error", error: error.message });
      });

      // If stopGhosting was called while we were setting up, honour it now.
      if (this.pendingStop) {
        this.pendingStop = false;
        await this.stopGhosting();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start recording";
      this.onMicLevel?.(0);
      this.setState({ phase: "error", error: message });
    }
  }

  async stopGhosting() {
    if (this.state.phase !== "recording" || !this.recordingSession) {
      // startGhosting may still be setting up – flag so it stops once ready.
      this.pendingStop = true;
      return;
    }

    const session = this.recordingSession;
    const durationMs = this.recordingStartTime
      ? Date.now() - this.recordingStartTime
      : 0;
    this.recordingSession = null;
    this.recordingStartTime = null;

    try {
      await stopRecording(session);
      this.onMicLevel?.(0);

      // Primary guard against Whisper hallucinations: check whether the
      // recorded audio contains *sustained* speech energy — not just a
      // brief transient from a keyboard click.  We scan the WAV file in
      // 50 ms windows and require at least 3 windows (~150 ms) above a
      // speech-level RMS threshold.  This reliably distinguishes real
      // spoken words from silence + key-press noise, regardless of
      // language or recording duration.
      const hasSpeech = await wavContainsSpeech(session.filePath);
      if (!hasSpeech) {
        this.setState({ phase: "idle", lastRawText: "", lastGhostedText: "" });
        return;
      }

      const currentSettings = this.getSettings();
      const languageForWhisper =
        currentSettings.transcriptionLanguages.length > 1
          ? "auto"
          : currentSettings.transcriptionLanguage;
      const rawText = await transcribeWithWhisper(
        session.filePath,
        languageForWhisper,
      );

      // Strip Whisper noise markers ([silence], (clicking), [BLANK_AUDIO],
      // etc.) and check for hallucinated short phrases to determine if the
      // recording contained any real speech.
      const speechOnly = stripNoiseMarkers(rawText ?? "");
      if (!speechOnly || isLikelyHallucination(speechOnly, durationMs)) {
        this.setState({ phase: "idle", lastRawText: "", lastGhostedText: "" });
        return;
      }

      this.setState({ phase: "cleaning", lastRawText: rawText });

      const { autoPaste, aiCleanup, aiModel } = currentSettings;
      const writingStyle =
        currentSettings.stylePreferences[this.recordingAppCategory] ?? "casual";
      let finalText: string;
      let tokenUsage: TokenUsageInfo | undefined;
      // Track filenames mentioned in speech for @-mention tagging in Cursor.
      // We extract these from the raw speech text — ALL spoken file names,
      // even ones already in auto-detected context — because we want to
      // create @-mention tags for them in the output.
      const mentionedFileNames = extractFileReferences(rawText);
      console.log("[ghostwriter] BundleId →", this.recordingBundleId);

      if (aiCleanup) {
        const dictionary = await loadDictionary();
        const snippets = await loadSnippets();

        // Load vibe code context when in a code editor with vibe code enabled
        const autoFileDetection = currentSettings.autoFileDetection;
        const isCodeApp = this.recordingAppCategory === "code";
        let vibeCodeFiles = undefined;

        if (autoFileDetection && isCodeApp) {
          // Auto-detect the currently open file in the editor
          const { context: autoContext, workspaceFolder } =
            await detectActiveEditorContext();
          // Load manually pinned files
          const pinnedContext = await readVibeCodeFileContents();

          // Merge: auto-detected first, then pinned (dedup by filePath)
          const combined = [...autoContext];
          const seenPaths = new Set(autoContext.map((f) => f.filePath));
          for (const pinned of pinnedContext) {
            if (!seenPaths.has(pinned.filePath)) {
              combined.push(pinned);
              seenPaths.add(pinned.filePath);
            }
          }

          // Resolve files mentioned by name in the speech
          if (workspaceFolder) {
            const spokenRefs = await resolveSpokenFileReferences(
              rawText,
              workspaceFolder,
              seenPaths,
            );
            combined.push(...spokenRefs);
          }

          if (combined.length > 0) vibeCodeFiles = combined;
        }

        const cleanupResult = await cleanupGhostedText(
          rawText,
          aiModel,
          writingStyle,
          dictionary,
          snippets,
          vibeCodeFiles,
        );
        finalText = cleanupResult.text;
        tokenUsage = cleanupResult.tokenUsage;
      } else {
        finalText = rawText;
      }

      // Safety net: if the cleaned text is empty or still looks like a
      // hallucination after AI cleanup, there's nothing real to paste.
      const cleanedSpeech = stripNoiseMarkers(finalText);
      if (!cleanedSpeech || isLikelyHallucination(cleanedSpeech, durationMs)) {
        this.setState({
          phase: "idle",
          lastRawText: rawText,
          lastGhostedText: "",
        });
        return;
      }

      this.setState({ lastGhostedText: finalText, phase: "idle" });

      // Also scan the AI-cleaned output for file references (the AI may
      // have normalised a spoken filename that Whisper mangled).
      const editorFileTagging = currentSettings.editorFileTagging;
      let allFileRefs: string[] = [];

      if (editorFileTagging) {
        const outputFileRefs = extractFileReferences(finalText);
        allFileRefs = [...new Set([...mentionedFileNames, ...outputFileRefs])];
      }

      await applyGhostedText(finalText, {
        autoPaste,
        fileReferences: allFileRefs,
        bundleId: this.recordingBundleId,
      });

      // Notify about the completed session for stats tracking
      const wordCount = finalText.split(/\s+/).filter(Boolean).length;
      this.onSessionComplete?.({
        wordCount,
        durationMs,
        rawLength: rawText.length,
        cleanedLength: finalText.length,
        rawText,
        cleanedText: finalText,
        appName: this.recordingAppName,
        tokenUsage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({ phase: "error", error: message });
    } finally {
      this.onMicLevel?.(0);
      await fs.rm(session.filePath, { force: true });
    }
  }

  async cancelGhosting() {
    if (this.state.phase !== "recording" || !this.recordingSession) return;

    const session = this.recordingSession;
    this.recordingSession = null;
    this.recordingStartTime = null;

    try {
      await stopRecording(session);
    } catch {
      // ignore errors during cancel
    } finally {
      this.onMicLevel?.(0);
      await fs.rm(session.filePath, { force: true });
    }

    this.setState({ phase: "idle", error: null });
  }
}
