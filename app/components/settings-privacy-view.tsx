"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  GhostwriterSettings,
  GhostwriterSettingsUpdate,
} from "@/types/ghostwriter";
import { useMutation } from "convex/react";
import { useState } from "react";
import { ToggleRow } from "./settings-toggle-row";

export type SettingsPrivacyViewProps = {
  settings: GhostwriterSettings | null;
  userId: Id<"users">;
  onUpdateSettings: (patch: GhostwriterSettingsUpdate) => void;
};

export function SettingsPrivacyView({
  settings,
  userId,
  onUpdateSettings,
}: SettingsPrivacyViewProps) {
  const [problemMessage, setProblemMessage] = useState("");
  const [problemDetails, setProblemDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const reportProblemMutation = useMutation(api.users.reportProblem);

  async function submitProblemReport() {
    setReportSubmitting(true);
    setReportError(null);
    setReportStatus(null);
    try {
      let details = problemDetails.trim();
      if (window.ghostwriter) {
        try {
          const deviceId = await window.ghostwriter.getDeviceId();
          if (deviceId) {
            details = `${details}\n\nDevice ID: ${deviceId}`.trim();
          }
        } catch {
          // best effort
        }
      }

      await reportProblemMutation({
        userId,
        message: problemMessage,
        details: details || undefined,
      });
      setProblemMessage("");
      setProblemDetails("");
      setReportStatus("Thanks — your report has been submitted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to submit report.";
      setReportError(message);
    } finally {
      setReportSubmitting(false);
    }
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {/* Privacy toggles */}
      <ToggleRow
        label="Help improve GhostWriter"
        description="Share transcriptions anonymously to improve accuracy."
        value={settings?.shareTranscripts ?? false}
        onToggle={() =>
          onUpdateSettings({
            shareTranscripts: !(settings?.shareTranscripts ?? false),
          })
        }
      />
      <ToggleRow
        label="Auto-learn corrections"
        description="Add words to dictionary when you edit ghosted text."
        value={settings?.autoDictionary ?? true}
        onToggle={() =>
          onUpdateSettings({
            autoDictionary: !(settings?.autoDictionary ?? true),
          })
        }
      />

      {/* Report a problem */}
      <div className="py-5">
        <p className="text-sm font-medium text-ink">Report a problem</p>
        <p className="mt-0.5 text-xs text-muted">
          Tell us what happened. Include reproduction steps when possible.
        </p>
        <textarea
          value={problemMessage}
          onChange={(event) => setProblemMessage(event.target.value)}
          placeholder="What happened?"
          rows={3}
          className="mt-3 w-full rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <textarea
          value={problemDetails}
          onChange={(event) => setProblemDetails(event.target.value)}
          placeholder="Optional: steps to reproduce, expected vs actual behavior"
          rows={4}
          className="mt-2 w-full rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="button"
          onClick={submitProblemReport}
          disabled={reportSubmitting || problemMessage.trim().length < 10}
          className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-50 hover:cursor-pointer"
        >
          {reportSubmitting ? "Submitting..." : "Send report"}
        </button>
        {reportStatus && (
          <p className="mt-2 text-xs text-accent">{reportStatus}</p>
        )}
        {reportError && (
          <p className="mt-2 text-xs text-ember">{reportError}</p>
        )}
      </div>
    </div>
  );
}
