"use client";

import { GhostActivityCalendar } from "./ghost-activity-calendar";
import { PageLayout } from "./page-layout";

export function StatsView({
  stats,
}: {
  stats: {
    totalWords: number;
    totalSessions: number;
    totalDaysActive: number;
    totalDurationMs: number;
    avgWordsPerMinute: number;
    currentStreak: number;
    longestStreak: number;
    recentDays: { date: string; wordCount: number; sessionCount: number }[];
    topApps: { appName: string; sessionCount: number; wordCount: number }[];
  } | null;
}) {
  if (!stats) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-sm text-muted">Loading stats…</p>
      </div>
    );
  }

  // Format total duration
  const totalMinutes = Math.floor(stats.totalDurationMs / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const formattedDuration =
    totalHours > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalMinutes}m`;

  return (
    <PageLayout title="Stats">
      <div className="flex flex-col gap-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">🚀</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {stats.totalWords.toLocaleString()}
            </span>
            <span className="text-xs text-muted">Words spoken</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">🎙️</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {stats.avgWordsPerMinute}
            </span>
            <span className="text-xs text-muted">Words / min</span>
          </div>
        </div>

        {/* Secondary stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">🔥</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {stats.currentStreak}
            </span>
            <span className="text-xs text-muted">Day streak</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">⚡</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {stats.totalSessions}
            </span>
            <span className="text-xs text-muted">Times spoken</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">⏱️</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {formattedDuration}
            </span>
            <span className="text-xs text-muted">Time spoken</span>
          </div>
        </div>

        {/* Activity calendar – full year */}
        <GhostActivityCalendar days={stats.recentDays} />

        {/* Top apps breakdown */}
        {stats.topApps.filter((a) => a.appName !== "Unknown").length > 0 && (
          <div className="rounded-xl border border-border bg-white p-5">
            <p className="mb-4 text-sm font-medium text-ink">
              Top apps you are ghosting in
            </p>
            <div className="flex flex-col gap-3">
              {stats.topApps
                .filter((a) => a.appName !== "Unknown")
                .slice(0, 8)
                .map((app, i) => {
                  const maxSessions = stats.topApps.filter(
                    (a) => a.appName !== "Unknown",
                  )[0].sessionCount;
                  const pct = Math.max(
                    4,
                    Math.round((app.sessionCount / maxSessions) * 100),
                  );
                  return (
                    <div key={app.appName} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">
                          {i + 1}. {app.appName}
                        </span>
                        <span className="text-muted">
                          {app.sessionCount}{" "}
                          {app.sessionCount === 1 ? "session" : "sessions"} ·{" "}
                          {app.wordCount.toLocaleString()} words
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
