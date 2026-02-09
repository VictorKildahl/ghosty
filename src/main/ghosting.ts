import fs from "node:fs/promises";
import { cleanupGhostedText } from "./aiGateway";
import { startRecording, stopRecording, type RecordingSession } from "./audio";
import { applyGhostedText } from "./paste";
import { transcribeWithWhisper } from "./whisper";
import type { GhosttypeSettings } from "./settings";

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
  private state: GhostingState = {
    phase: "idle",
    lastGhostedText: "",
    lastRawText: "",
    error: null
  };

  constructor(
    private readonly onState: (state: GhostingState) => void,
    private readonly getSettings: () => GhosttypeSettings
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

    const session = startRecording();
    this.recordingSession = session;
    this.setState({ phase: "recording", error: null });

    session.process.once("error", (error) => {
      this.recordingSession = null;
      this.setState({ phase: "error", error: error.message });
    });
  }

  async stopGhosting() {
    if (this.state.phase !== "recording" || !this.recordingSession) return;

    const session = this.recordingSession;
    this.recordingSession = null;

    try {
      await stopRecording(session);
      this.setState({ phase: "transcribing" });

      const rawText = await transcribeWithWhisper(session.filePath);
      this.setState({ phase: "cleaning", lastRawText: rawText });

      if (!rawText) {
        this.setState({ phase: "idle", lastGhostedText: "" });
        return;
      }

      const cleanedText = await cleanupGhostedText(rawText);
      this.setState({ lastGhostedText: cleanedText, phase: "idle" });

      const { autoPaste } = this.getSettings();
      await applyGhostedText(cleanedText, { autoPaste });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({ phase: "error", error: message });
    } finally {
      await fs.rm(session.filePath, { force: true });
    }
  }
}
