import fs from "node:fs/promises";
import { cleanupGhostedText } from "./aiGateway";
import {
  detectAppCategory,
  getFrontmostAppName,
  type AppCategory,
} from "./appCategory";
import {
  getDefaultInputDeviceName,
  startRecording,
  stopRecording,
  type RecordingSession,
} from "./audio";
import { loadDictionary } from "./dictionaryStore";
import { detectActiveEditorContext } from "./editorContext";
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
      this.recordingAppCategory = detectAppCategory();
      this.recordingAppName = getFrontmostAppName();
      this.setState({ phase: "recording", error: null });

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

      if (aiCleanup) {
        const dictionary = await loadDictionary();
        const snippets = await loadSnippets();

        // Load vibe code context when in a code editor with vibe code enabled
        const vibeCodeEnabled = this.getSettings().vibeCodeEnabled;
        const isCodeApp = this.recordingAppCategory === "code";
        let vibeCodeFiles = undefined;

        if (vibeCodeEnabled && isCodeApp) {
          // Auto-detect the currently open file in the editor
          const autoContext = await detectActiveEditorContext();
          // Load manually pinned files
          const pinnedContext = await readVibeCodeFileContents();
          // Merge: auto-detected first, then pinned (dedup by filePath)
          const combined = [...autoContext];
          const autoPaths = new Set(autoContext.map((f) => f.filePath));
          for (const pinned of pinnedContext) {
            if (!autoPaths.has(pinned.filePath)) combined.push(pinned);
          }
          if (combined.length > 0) vibeCodeFiles = combined;
        }

        finalText = await cleanupGhostedText(
          rawText,
          aiModel,
          writingStyle,
          dictionary,
          snippets,
          vibeCodeFiles,
        );
      } else {
        console.log("[ghosttype] ai cleanup skipped");
        finalText = rawText;
      }

      this.setState({ lastGhostedText: finalText, phase: "idle" });
      await applyGhostedText(finalText, { autoPaste });

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
