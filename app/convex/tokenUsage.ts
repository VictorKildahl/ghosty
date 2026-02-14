import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const record = mutation({
  args: {
    userId: v.id("users"),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCost: v.optional(v.number()),
    localDate: v.optional(v.string()), // "YYYY-MM-DD" in the user's local timezone
  },
  handler: async (
    ctx,
    { userId, model, inputTokens, outputTokens, estimatedCost, localDate },
  ) => {
    const now = Date.now();
    // Use the client-supplied local date if provided, otherwise fall back to UTC
    const date = localDate ?? new Date(now).toISOString().slice(0, 10);

    await ctx.db.insert("tokenUsage", {
      userId,
      model,
      inputTokens,
      outputTokens,
      ...(estimatedCost !== undefined ? { estimatedCost } : {}),
      timestamp: now,
      date,
    });

    // Update running totals on the user document
    const user = await ctx.db.get(userId);
    if (user) {
      const cost = estimatedCost ?? 0;
      await ctx.db.patch(userId, {
        totalInputTokens: (user.totalInputTokens ?? 0) + inputTokens,
        totalOutputTokens: (user.totalOutputTokens ?? 0) + outputTokens,
        totalTokens: (user.totalTokens ?? 0) + inputTokens + outputTokens,
        totalAiCost: (user.totalAiCost ?? 0) + cost,
        totalAiCalls: (user.totalAiCalls ?? 0) + 1,
      });
    }
  },
});

export const getSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db
      .query("tokenUsage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    const byModel: Record<
      string,
      { inputTokens: number; outputTokens: number; cost: number; calls: number }
    > = {};

    for (const entry of all) {
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;
      totalCost += entry.estimatedCost ?? 0;

      const m = byModel[entry.model] ?? {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        calls: 0,
      };
      m.inputTokens += entry.inputTokens;
      m.outputTokens += entry.outputTokens;
      m.cost += entry.estimatedCost ?? 0;
      m.calls += 1;
      byModel[entry.model] = m;
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost,
      totalCalls: all.length,
      byModel,
    };
  },
});
