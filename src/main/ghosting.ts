import fs from "node:fs/promises";
import { cleanupGhostedText } from "./aiGateway";
import { startRecording, stopRecording, type RecordingSession } from "./audio";
import { applyGhostedText } from "./paste";
import type { GhosttypeSettings } from "./settings";
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

    const session = startRecording(this.getSettings().selectedMicrophone);
    this.recordingSession = session;
    this.recordingStartTime = Date.now();
    this.setState({ phase: "recording", error: null });

    session.process.once("error", (error) => {
      this.recordingSession = null;
      this.setState({ phase: "error", error: error.message });
    });
  }

  async stopGhosting() {
    if (this.state.phase !== "recording" || !this.recordingSession) return;

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
      let finalText: string;

      if (aiCleanup) {
        finalText = await cleanupGhostedText(rawText, aiModel);
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
