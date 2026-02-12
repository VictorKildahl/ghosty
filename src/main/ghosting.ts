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
import type { GhosttypeSettings } from "./settings";
import { loadSnippets } from "./snippetStore";
import { readVibeCodeFileContents } from "./vibeCodeStore";
import { transcribeWithWhisper } from "./whisper";

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
    private readonly getSettings: () => GhosttypeSettings,
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
  ) {}

  getState() {
    return this.state;
  }

  private setState(patch: Partial<GhostingState>) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }

  async startGhosting() {
    if (
      this.state.phase === "recording" ||
      this.state.phase === "transcribing" ||
      this.state.phase === "cleaning"
    ) {
      return;
    }

    this.pendingStop = false;

    // When the user hasn't picked a specific mic, resolve the real macOS
    // default input device (cached, fast) instead of blindly using index 0.
    const configured = this.getSettings().selectedMicrophone ?? null;
    const selectedMic = configured ?? (await getDefaultInputDeviceName());

    try {
      const session = startRecording(selectedMic);
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
      this.setState({ phase: "transcribing" });

      const rawText = await transcribeWithWhisper(session.filePath);

      if (!rawText || rawText.trim() === "[BLANK_AUDIO]") {
        console.log("[ghosttype] no speech detected, skipping");
        this.setState({ phase: "idle", lastRawText: "", lastGhostedText: "" });
        return;
      }

      this.setState({ phase: "cleaning", lastRawText: rawText });

      const { autoPaste, aiCleanup, aiModel } = this.getSettings();
      const writingStyle =
        this.getSettings().stylePreferences[this.recordingAppCategory] ??
        "casual";
      let finalText: string;
      let tokenUsage: TokenUsageInfo | undefined;
      // Track filenames mentioned in speech for @-mention tagging in Cursor.
      // We extract these from the raw speech text — ALL spoken file names,
      // even ones already in auto-detected context — because we want to
      // create @-mention tags for them in the output.
      const mentionedFileNames = extractFileReferences(rawText);
      console.log(
        "[ghosttype] file refs from speech →",
        mentionedFileNames,
        "| bundleId →",
        this.recordingBundleId,
      );

      if (aiCleanup) {
        const dictionary = await loadDictionary();
        const snippets = await loadSnippets();

        // Load vibe code context when in a code editor with vibe code enabled
        const autoFileDetection = this.getSettings().autoFileDetection;
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
        console.log("[ghosttype] ai cleanup skipped");
        finalText = rawText;
      }

      this.setState({ lastGhostedText: finalText, phase: "idle" });

      // Also scan the AI-cleaned output for file references (the AI may
      // have normalised a spoken filename that Whisper mangled).
      const editorFileTagging = this.getSettings().editorFileTagging;
      let allFileRefs: string[] = [];

      if (editorFileTagging) {
        const outputFileRefs = extractFileReferences(finalText);
        allFileRefs = [...new Set([...mentionedFileNames, ...outputFileRefs])];
        if (allFileRefs.length !== mentionedFileNames.length) {
          console.log(
            "[ghosttype] additional refs from AI output →",
            outputFileRefs,
          );
        }
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
      await fs.rm(session.filePath, { force: true });
    }

    console.log("[ghosttype] recording cancelled");
    this.setState({ phase: "idle", error: null });
  }
}
