"use client";

import {
  formatShortcut,
  formatTime,
  groupByDate,
  type GhostLogEntry,
} from "@/lib/ghost-helpers";
import type {
  GhostingState,
  GhosttypeSettings,
  LocalTranscript,
} from "@/types/ghosttype";
import { useEffect, useState } from "react";

export function HomeView({
  stats,
  localTranscripts,
  userName,
}: {
  stats: {
    totalWords: number;
    currentStreak: number;
  } | null;
  localTranscripts: LocalTranscript[];
  userName?: string;
}) {
  const [state, setState] = useState<GhostingState>({
    phase: "idle",
    lastGhostedText: "",
    lastRawText: "",
    error: null,
  });
  const [settings, setSettings] = useState<GhosttypeSettings | null>(null);
  const [ghostLog, setGhostLog] = useState<GhostLogEntry[]>([]);

  // Seed ghost log from persisted local transcripts
  useEffect(() => {
    if (localTranscripts.length > 0) {
      setGhostLog((prev) => {
        // Only seed if the log is empty (initial load)
        if (prev.length > 0) return prev;
        return localTranscripts.map((t) => ({
          timestamp: new Date(t.timestamp),
          text: t.cleanedText,
        }));
      });
    }
  }, [localTranscripts]);

  useEffect(() => {
    if (!window.ghosttype) return;

    window.ghosttype
      .getState()
      .then(setState)
      .catch(() => undefined);
    window.ghosttype
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);

    const unsubscribeState = window.ghosttype.onGhostingState(setState);
    const unsubscribeSettings = window.ghosttype.onSettings(setSettings);

    return () => {
      unsubscribeState();
      unsubscribeSettings();
    };
  }, []);

  // Track ghosted text in the log
  useEffect(() => {
    if (state.lastGhostedText) {
      setGhostLog((prev) => {
        if (prev.length > 0 && prev[0].text === state.lastGhostedText)
          return prev;
        return [
          { timestamp: new Date(), text: state.lastGhostedText },
          ...prev,
        ];
      });
    }
  }, [state.lastGhostedText]);

  const sessionWordCount = ghostLog.reduce(
    (sum, entry) => sum + entry.text.split(/\s+/).filter(Boolean).length,
    0,
  );

  const totalWords = stats ? stats.totalWords : sessionWordCount;
  const streak = stats ? stats.currentStreak : ghostLog.length > 0 ? 1 : 0;

  const groups = groupByDate(ghostLog);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header with stats */}
      <header className="border-b border-border px-8 pt-8 pb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-ink">
            Welcome back{userName ? `, ${userName}` : ""}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <span>🔥</span>
              <span className="font-medium text-ink">
                {streak === 1 ? "1 day" : `${streak} days`}
              </span>
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5">
              <span>🚀</span>
              <span className="font-medium text-ink">{totalWords} words</span>
            </span>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-5 flex h-36 items-center justify-center rounded-xl bg-sidebar">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted">
              {state.phase === "idle" ? (
                <>
                  Hold{" "}
                  <span className="ghosttype-code font-medium text-ghosty">
                    {formatShortcut(settings?.shortcut ?? null) ||
                      "Cmd + Shift + Space"}
                  </span>{" "}
                  to ghost
                </>
              ) : state.phase === "recording" ||
                state.phase === "transcribing" ? (
                <span className="font-medium text-ghosty">Ghosting…</span>
              ) : state.phase === "cleaning" ? (
                <span className="font-medium text-ghosty">Cleaning up…</span>
              ) : state.phase === "error" ? (
                <span className="font-medium text-ember">
                  {state.error || "Something went wrong"}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      {/* Activity log */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {groups.length === 0 ? (
          <p className="text-sm text-muted">
            No ghosted text yet. Start ghosting to see your activity here.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="mb-6">
              <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
                {group.date}
              </p>
              <div className="divide-y divide-border">
                {group.entries.map((entry, i) => (
                  <div key={i} className="flex gap-6 py-3 text-sm">
                    <span className="w-20 shrink-0 text-muted">
                      {formatTime(entry.timestamp)}
                    </span>
                    <p className="text-ink">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
