import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entries = await ctx.db
      .query("snippetEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Most recent first
    entries.sort((a, b) => b.createdAt - a.createdAt);
    return entries;
  },
});

export const add = mutation({
  args: {
    userId: v.id("users"),
    snippet: v.string(),
    expansion: v.string(),
  },
  handler: async (ctx, { userId, snippet, expansion }) => {
    const id = await ctx.db.insert("snippetEntries", {
      userId,
      snippet,
      expansion,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    entryId: v.id("snippetEntries"),
    snippet: v.string(),
    expansion: v.string(),
  },
  handler: async (ctx, { entryId, snippet, expansion }) => {
    await ctx.db.patch(entryId, { snippet, expansion });
    return await ctx.db.get(entryId);
  },
});

export const remove = mutation({
  args: { entryId: v.id("snippetEntries") },
  handler: async (ctx, { entryId }) => {
    await ctx.db.delete(entryId);
  },
});

/**
 * Seed default snippet entries for a newly signed-up user.
 * Gives them a few useful examples out of the box so the feature
 * feels immediately useful.
 */
export const seed = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, { userId, email }) => {
    // Avoid double-seeding if called again
    const existing = await ctx.db
      .query("snippetEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) return;

    const now = Date.now();

    type Entry = {
      userId: typeof userId;
      snippet: string;
      expansion: string;
      createdAt: number;
    };

    const entries: Entry[] = [
      {
        userId,
        snippet: "my email address",
        expansion: email,
        createdAt: now,
      },
      {
        userId,
        snippet: "my address",
        expansion: "123 Main Street, Apt 4B, San Francisco, CA 94102",
        createdAt: now - 1,
      },
      {
        userId,
        snippet: "intro email",
        expansion:
          "Hey, would love to find some time to chat later this week. Let me know what works for you!",
        createdAt: now - 2,
      },
    ];

    await Promise.all(
      entries.map((entry) => ctx.db.insert("snippetEntries", entry)),
    );
  },
});
