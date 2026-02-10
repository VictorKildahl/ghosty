import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const record = mutation({
  args: {
    userId: v.id("users"),
    wordCount: v.number(),
    durationMs: v.number(),
    rawLength: v.number(),
    cleanedLength: v.number(),
  },
  handler: async (ctx, { userId, wordCount, durationMs, rawLength, cleanedLength }) => {
    const now = Date.now();
    const date = new Date(now).toISOString().slice(0, 10); // "YYYY-MM-DD"

    // Insert the session
    await ctx.db.insert("sessions", {
      userId,
      wordCount,
      durationMs,
      rawLength,
      cleanedLength,
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
