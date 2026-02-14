import { v } from "convex/values";
import { query } from "./_generated/server";

export const get = query({
  args: {
    userId: v.id("users"),
    localToday: v.optional(v.string()), // "YYYY-MM-DD" in the user's local timezone
  },
  handler: async (ctx, { userId, localToday }) => {
    // Get all daily stats for the user, ordered by date
    const allDays = await ctx.db
      .query("dailyStats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Sort by date ascending
    allDays.sort((a, b) => a.date.localeCompare(b.date));

    // Compute totals
    let totalWords = 0;
    let totalSessions = 0;
    let totalDurationMs = 0;
    for (const day of allDays) {
      totalWords += day.wordCount;
      totalSessions += day.sessionCount;
      totalDurationMs += day.totalDurationMs ?? 0;
    }

    // Compute streaks
    const today = localToday ?? new Date().toISOString().slice(0, 10);
    const dates = new Set(allDays.map((d) => d.date));

    let currentStreak = 0;
    let longestStreak = 0;

    // Calculate current streak (counting back from today)
    const checkDate = new Date();
    // If today has no activity, check if yesterday does (allow "still active" streak)
    if (!dates.has(today)) {
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterday = checkDate.toISOString().slice(0, 10);
      if (!dates.has(yesterday)) {
        currentStreak = 0;
      } else {
        // Count from yesterday
        let d = new Date(checkDate);
        while (dates.has(d.toISOString().slice(0, 10))) {
          currentStreak++;
          d.setDate(d.getDate() - 1);
        }
      }
    } else {
      // Count from today
      let d = new Date(checkDate);
      while (dates.has(d.toISOString().slice(0, 10))) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      }
    }

    // Calculate longest streak
    if (allDays.length > 0) {
      let streak = 1;
      for (let i = 1; i < allDays.length; i++) {
        const prev = new Date(allDays[i - 1].date);
        const curr = new Date(allDays[i].date);
        const diffDays = Math.round(
          (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays === 1) {
          streak++;
        } else if (diffDays > 1) {
          longestStreak = Math.max(longestStreak, streak);
          streak = 1;
        }
        // diffDays === 0 means same day, keep streak the same
      }
      longestStreak = Math.max(longestStreak, streak);
    }

    // Get last year of daily stats for the activity calendar
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setDate(oneYearAgo.getDate() + 1);
    const yearStartDate = oneYearAgo.toISOString().slice(0, 10);

    const recentDays = allDays.filter((d) => d.date >= yearStartDate);

    // Total days active
    const totalDaysActive = allDays.length;

    // Average words per minute
    const totalMinutes = totalDurationMs / 60_000;
    const avgWordsPerMinute =
      totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 0;

    // ── App usage breakdown ─────────────────────────────────────────
    // Aggregate session counts and word counts per target app
    const allSessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const appMap = new Map<
      string,
      { sessionCount: number; wordCount: number }
    >();
    for (const s of allSessions) {
      const name = s.appName ?? "Unknown";
      const existing = appMap.get(name) ?? { sessionCount: 0, wordCount: 0 };
      existing.sessionCount += 1;
      existing.wordCount += s.wordCount;
      appMap.set(name, existing);
    }

    const topApps = Array.from(appMap.entries())
      .map(([appName, data]) => ({
        appName,
        sessionCount: data.sessionCount,
        wordCount: data.wordCount,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    return {
      totalWords,
      totalSessions,
      totalDaysActive,
      totalDurationMs,
      avgWordsPerMinute,
      currentStreak,
      longestStreak,
      recentDays: recentDays.map((d) => ({
        date: d.date,
        wordCount: d.wordCount,
        sessionCount: d.sessionCount,
      })),
      topApps,
    };
  },
});
