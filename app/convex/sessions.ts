import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const record = mutation({
  args: {
    userId: v.id("users"),
    wordCount: v.number(),
    durationMs: v.number(),
    rawLength: v.number(),
    cleanedLength: v.number(),
    rawText: v.optional(v.string()),
    cleanedText: v.optional(v.string()),
    appName: v.optional(v.string()),
    localDate: v.optional(v.string()), // "YYYY-MM-DD" in the user's local timezone
  },
  handler: async (
    ctx,
    {
      userId,
      wordCount,
      durationMs,
      rawLength,
      cleanedLength,
      rawText,
      cleanedText,
      appName,
      localDate,
    },
  ) => {
    const now = Date.now();
    // Use the client-supplied local date if provided, otherwise fall back to UTC
    const date = localDate ?? new Date(now).toISOString().slice(0, 10);

    // Insert the session
    await ctx.db.insert("sessions", {
      userId,
      wordCount,
      durationMs,
      rawLength,
      cleanedLength,
      ...(rawText !== undefined ? { rawText } : {}),
      ...(cleanedText !== undefined ? { cleanedText } : {}),
      ...(appName !== undefined ? { appName } : {}),
      timestamp: now,
      date,
    });

    // Upsert daily stats
    const existing = await ctx.db
      .query("dailyStats")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", date),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        wordCount: existing.wordCount + wordCount,
        sessionCount: existing.sessionCount + 1,
        totalDurationMs: (existing.totalDurationMs ?? 0) + durationMs,
      });
    } else {
      await ctx.db.insert("dailyStats", {
        userId,
        date,
        wordCount,
        sessionCount: 1,
        totalDurationMs: durationMs,
      });
    }
  },
});

export const listRecent = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
    return sessions;
  },
});

export const deleteByTimestamp = mutation({
  args: {
    userId: v.id("users"),
    timestamp: v.number(),
  },
  handler: async (ctx, { userId, timestamp }) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const match = sessions.find((s) => s.timestamp === timestamp);
    if (!match) return;

    await ctx.db.delete(match._id);

    // Update daily stats
    const dailyStat = await ctx.db
      .query("dailyStats")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", userId).eq("date", match.date),
      )
      .first();

    if (dailyStat) {
      const newWordCount = dailyStat.wordCount - match.wordCount;
      const newSessionCount = dailyStat.sessionCount - 1;

      if (newSessionCount <= 0) {
        await ctx.db.delete(dailyStat._id);
      } else {
        await ctx.db.patch(dailyStat._id, {
          wordCount: Math.max(0, newWordCount),
          sessionCount: newSessionCount,
          totalDurationMs: Math.max(
            0,
            (dailyStat.totalDurationMs ?? 0) - (match.durationMs ?? 0),
          ),
        });
      }
    }
  },
});
