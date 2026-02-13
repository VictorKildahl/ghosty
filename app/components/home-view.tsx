"use client";

import {
  formatShortcut,
  formatTime,
  groupByDate,
  type GhostLogEntry,
} from "@/lib/ghost-helpers";
import type {
  GhostingState,
  GhostwriterSettings,
  LocalTranscript,
} from "@/types/ghostwriter";
import { Check, Copy, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataTable, RowActionButton } from "./data-table";
import { PageLayout } from "./page-layout";

export function HomeView({
  stats,
  localTranscripts,
  userName,
  onNavigateToStats,
  onDeleteEntry,
}: {
  stats: {
    totalWords: number;
    currentStreak: number;
    avgWordsPerMinute: number;
  } | null;
  localTranscripts: LocalTranscript[];
  userName?: string;
  onNavigateToStats?: () => void;
  onDeleteEntry?: (timestamp: number) => void;
}) {
  const [state, setState] = useState<GhostingState>({
    phase: "idle",
    lastGhostedText: "",
    lastRawText: "",
    error: null,
  });
  const [settings, setSettings] = useState<GhostwriterSettings | null>(null);
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
    if (!window.ghostwriter) return;

    window.ghostwriter
      .getState()
      .then(setState)
      .catch(() => undefined);
    window.ghostwriter
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);

    const unsubscribeState = window.ghostwriter.onGhostingState(setState);
    const unsubscribeSettings = window.ghostwriter.onSettings(setSettings);

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

        // Persist the deletion to local file and Convex
        onDeleteEntry?.(entryToDelete.timestamp.getTime());

        return prev.filter(
          (e) =>
            !(
              e.timestamp.getTime() === entryToDelete.timestamp.getTime() &&
              e.text === entryToDelete.text
            ),
        );
      });
    },
    [onDeleteEntry],
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
      <div className="mb-6 rounded-xl bg-sidebar p-6">
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
            <h2 className="text-2xl leading-snug font-semibold text-ink">
              Hold{" "}
              <span className="ghostwriter-code text-2xl! text-ghosty">
                {shortcutLabel}
              </span>{" "}
              to dictate and let
              <br />
              GhostWriter format for you
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Press and hold{" "}
              <span className="ghostwriter-code font-medium text-ghosty">
                {shortcutLabel}
              </span>{" "}
              to dictate in any app. GhostWriter&apos;s{" "}
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
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.date}>
              {/* Date header with copy-all button */}
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-widest text-muted uppercase">
                  {group.date}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopyGroup(group.entries, group.date)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-sidebar hover:text-ink hover:cursor-pointer"
                >
                  {copiedGroup === group.date ? (
                    <>
                      <Check size={14} className="text-ghosty" />
                      <span className="text-ghosty">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy transcript</span>
                    </>
                  )}
                </button>
              </div>

              {/* Entries */}
              <DataTable
                items={group.entries.map((entry, i) => ({
                  key: `${group.date}-${i}`,
                  entry,
                  index: i,
                  groupDate: group.date,
                }))}
                renderContent={(item) => (
                  <div className="flex items-center gap-6">
                    <span className="w-20 shrink-0 text-muted">
                      {formatTime(item.entry.timestamp)}
                    </span>
                    <p className="flex-1 leading-relaxed text-ink">
                      {item.entry.text}
                    </p>
                  </div>
                )}
                renderActions={(item) => (
                  <>
                    <RowActionButton
                      icon={Copy}
                      activeIcon={Check}
                      active={copiedIndex === item.key}
                      label="Copy to clipboard"
                      onClick={() => handleCopyEntry(item.entry.text, item.key)}
                    />
                    <RowActionButton
                      icon={Trash2}
                      label="Delete entry"
                      variant="danger"
                      onClick={() =>
                        handleDeleteEntry(item.groupDate, item.index)
                      }
                    />
                  </>
                )}
              />
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
