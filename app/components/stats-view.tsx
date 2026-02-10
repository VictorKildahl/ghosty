"use client";

import { cn } from "@/lib/utils";

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
  } | null;
}) {
  if (!stats) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-sm text-muted">Loading stats…</p>
      </div>
    );
  }

  const maxWords = Math.max(...stats.recentDays.map((d) => d.wordCount), 1);

  // Format total duration
  const totalMinutes = Math.floor(stats.totalDurationMs / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const formattedDuration =
    totalHours > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalMinutes}m`;

  // Build full 30-day range for the chart
  const dayMap = new Map(stats.recentDays.map((d) => [d.date, d]));
  const chartDays: { date: string; wordCount: number; sessionCount: number }[] =
    [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    chartDays.push(
      dayMap.get(dateStr) ?? { date: dateStr, wordCount: 0, sessionCount: 0 },
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-8 pt-8 pb-6">
        <h1 className="text-2xl font-semibold text-ink">Stats</h1>
        <p className="mt-1 text-sm text-muted">
          Your ghosting activity at a glance.
        </p>
      </header>

      <div className="flex flex-col gap-6 px-8 py-6">
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
            <span className="text-xs text-muted">Total sessions</span>
          </div>
        </div>

        {/* Secondary stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">🏆</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {stats.longestStreak}
            </span>
            <span className="text-xs text-muted">Longest streak</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">📅</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {stats.totalDaysActive}
            </span>
            <span className="text-xs text-muted">Days active</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
            <span className="text-2xl">⏱️</span>
            <span className="mt-2 text-2xl font-bold text-ink">
              {formattedDuration}
            </span>
            <span className="text-xs text-muted">Time spoken</span>
          </div>
        </div>

        {/* Activity chart - last 30 days */}
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="mb-4 text-sm font-medium text-ink">Last 30 days</p>
          <div className="flex items-end gap-1" style={{ height: 120 }}>
            {chartDays.map((day) => {
              const height =
                day.wordCount > 0
                  ? Math.max(4, (day.wordCount / maxWords) * 100)
                  : 2;
              const dateObj = new Date(day.date + "T00:00:00");
              const label = dateObj.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                  style={{ height: "100%" }}
                >
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-8 z-10 hidden rounded bg-ink px-2 py-1 text-xs text-white shadow-sm group-hover:block whitespace-nowrap">
                    {label}: {day.wordCount} words
                  </div>
                  <div
                    className={cn(
                      "w-full min-w-0.75 rounded-t transition-all",
                      day.wordCount > 0 ? "bg-accent" : "bg-border",
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted">
            <span>
              {new Date(chartDays[0].date + "T00:00:00").toLocaleDateString(
                [],
                { month: "short", day: "numeric" },
              )}
            </span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
