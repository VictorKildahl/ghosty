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
import { useCallback, useEffect, useRef, useState } from "react";
import { PageLayout } from "./page-layout";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function HomeView({
  stats,
  localTranscripts,
  userName,
  onNavigateToStats,
}: {
  stats: {
    totalWords: number;
    currentStreak: number;
    avgWordsPerMinute: number;
  } | null;
  localTranscripts: LocalTranscript[];
  userName?: string;
  onNavigateToStats?: () => void;
}) {
  const [state, setState] = useState<GhostingState>({
    phase: "idle",
    lastGhostedText: "",
    lastRawText: "",
    error: null,
  });
  const [settings, setSettings] = useState<GhosttypeSettings | null>(null);
  const [ghostLog, setGhostLog] = useState<GhostLogEntry[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyGroupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  const handleCopyEntry = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const handleCopyGroup = useCallback(
    (entries: GhostLogEntry[], groupDate: string) => {
      const text = entries
        .map((e) => `${formatTime(e.timestamp)}  ${e.text}`)
        .join("\n");
      navigator.clipboard.writeText(text);
      setCopiedGroup(groupDate);
      if (copyGroupTimeoutRef.current)
        clearTimeout(copyGroupTimeoutRef.current);
      copyGroupTimeoutRef.current = setTimeout(
        () => setCopiedGroup(null),
        2000,
      );
    },
    [],
  );

  const handleDeleteEntry = useCallback(
    (groupDate: string, entryIndex: number) => {
      setGhostLog((prev) => {
        const groups = groupByDate(prev);
        const group = groups.find((g) => g.date === groupDate);
        if (!group) return prev;
        const entryToDelete = group.entries[entryIndex];
        if (!entryToDelete) return prev;
        return prev.filter(
          (e) =>
            !(
              e.timestamp.getTime() === entryToDelete.timestamp.getTime() &&
              e.text === entryToDelete.text
            ),
        );
      });
    },
    [],
  );

  const sessionWordCount = ghostLog.reduce(
    (sum, entry) => sum + entry.text.split(/\s+/).filter(Boolean).length,
    0,
  );

  const totalWords = stats ? stats.totalWords : sessionWordCount;
  const streak = stats ? stats.currentStreak : ghostLog.length > 0 ? 1 : 0;
  const wpm = stats ? stats.avgWordsPerMinute : 0;

  const shortcutLabel =
    formatShortcut(settings?.shortcut ?? null) || "Cmd + Shift + Space";

  const groups = groupByDate(ghostLog);

  return (
    <PageLayout
      title={`Welcome back${userName ? `, ${userName}` : ""}`}
      headerRight={
        <button
          type="button"
          onClick={onNavigateToStats}
          className="flex cursor-pointer items-center gap-4 text-sm text-muted transition-opacity hover:opacity-70"
        >
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
          {wpm > 0 && (
            <>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <span>🏆</span>
                <span className="font-medium text-ink">{wpm} WPM</span>
              </span>
            </>
          )}
        </button>
      }
    >
      {/* Hero description card */}
      <div className="mb-8 rounded-xl bg-sidebar px-8 py-8">
        {state.phase === "error" ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="font-medium text-ember">
              {state.error || "Something went wrong"}
            </span>
          </div>
        ) : state.phase === "recording" || state.phase === "transcribing" ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="text-lg font-medium text-ghosty">Ghosting…</span>
          </div>
        ) : state.phase === "cleaning" ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="text-lg font-medium text-ghosty">
              Cleaning up…
            </span>
          </div>
        ) : (
          <>
            <h2 className="text-2xl leading-snug font-semibold text-ink md:text-3xl">
              Hold{" "}
              <span className="ghosttype-code text-3xl! text-ghosty md:text-2xl">
                {shortcutLabel}
              </span>{" "}
              to dictate and let
              <br />
              GhostType format for you
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Press and hold{" "}
              <span className="ghosttype-code font-medium text-ghosty">
                {shortcutLabel}
              </span>{" "}
              to dictate in any app. GhostType&apos;s{" "}
              <span className="font-semibold text-ink">Smart Formatting</span>{" "}
              will handle punctuation, new lines, lists, and adjust when you
              change your mind mid-sentence.
            </p>
          </>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">
          No ghosted text yet. Start ghosting to see your activity here.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="mb-8">
            {/* Date header with copy-all button */}
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-muted uppercase">
                {group.date}
              </p>
              <button
                type="button"
                onClick={() => handleCopyGroup(group.entries, group.date)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-sidebar hover:text-ink"
              >
                {copiedGroup === group.date ? (
                  <>
                    <CheckIcon className="text-ghosty" />
                    <span className="text-ghosty">Copied!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon />
                    <span>Copy transcript</span>
                  </>
                )}
              </button>
            </div>

            {/* Entries */}
            <div className="divide-y divide-border rounded-xl border border-border bg-white">
              {group.entries.map((entry, i) => {
                const entryKey = `${group.date}-${i}`;
                return (
                  <div
                    key={entryKey}
                    className="group flex items-start gap-6 px-5 py-4 text-sm"
                  >
                    <span className="w-20 shrink-0 pt-0.5 text-muted">
                      {formatTime(entry.timestamp)}
                    </span>
                    <p className="flex-1 leading-relaxed text-ink">
                      {entry.text}
                    </p>
                    {/* Action buttons — visible on hover */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleCopyEntry(entry.text, entryKey)}
                        className="rounded-md p-1.5 text-muted transition hover:bg-sidebar hover:text-ink"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === entryKey ? (
                          <CheckIcon className="text-ghosty" />
                        ) : (
                          <CopyIcon />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(group.date, i)}
                        className="rounded-md p-1.5 text-muted transition hover:bg-red-50 hover:text-red-500"
                        title="Delete entry"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </PageLayout>
  );
}
