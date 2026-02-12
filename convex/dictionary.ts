import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entries = await ctx.db
      .query("dictionaryEntries")
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
    word: v.string(),
    isCorrection: v.boolean(),
    misspelling: v.optional(v.string()),
    autoAdded: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { userId, word, isCorrection, misspelling, autoAdded },
  ) => {
    const id = await ctx.db.insert("dictionaryEntries", {
      userId,
      word,
      isCorrection,
      ...(isCorrection && misspelling ? { misspelling } : {}),
      ...(autoAdded ? { autoAdded } : {}),
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    entryId: v.id("dictionaryEntries"),
    word: v.string(),
    isCorrection: v.boolean(),
    misspelling: v.optional(v.string()),
  },
  handler: async (ctx, { entryId, word, isCorrection, misspelling }) => {
    await ctx.db.patch(entryId, {
      word,
      isCorrection,
      misspelling: isCorrection && misspelling ? misspelling : undefined,
    });
    return await ctx.db.get(entryId);
  },
});

export const remove = mutation({
  args: { entryId: v.id("dictionaryEntries") },
  handler: async (ctx, { entryId }) => {
    await ctx.db.delete(entryId);
  },
});

/** Accept an auto-learned entry, clearing its autoAdded badge. */
export const accept = mutation({
  args: { entryId: v.id("dictionaryEntries") },
  handler: async (ctx, { entryId }) => {
    await ctx.db.patch(entryId, { autoAdded: false });
  },
});

/**
 * Seed default dictionary entries for a newly signed-up user.
 * Mirrors what Wispr Flow does: adds the user's name, email, app name,
 * and a handful of common corrections so the AI produces better output
 * from day one.
 */
export const seed = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.string(),
  },
  handler: async (ctx, { userId, name, email }) => {
    // Avoid double-seeding if called again
    const existing = await ctx.db
      .query("dictionaryEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) return;

    const now = Date.now();

    type Entry = {
      userId: typeof userId;
      word: string;
      isCorrection: boolean;
      misspelling?: string;
      createdAt: number;
    };

    const entries: Entry[] = [];

    // User's first name (if provided)
    if (name?.trim()) {
      const firstName = name.trim().split(/\s+/)[0];
      entries.push({
        userId,
        word: firstName,
        isCorrection: false,
        createdAt: now,
      });

      // Full name (if it differs from first name)
      if (name.trim() !== firstName) {
        entries.push({
          userId,
          word: name.trim(),
          isCorrection: false,
          createdAt: now - 1,
        });
      }
    }

    // App name
    entries.push({
      userId,
      word: "GhostWriter",
      isCorrection: false,
      createdAt: now - 2,
    });

    // Common correction: btw → by the way
    entries.push({
      userId,
      word: "by the way",
      isCorrection: true,
      misspelling: "btw",
      createdAt: now - 3,
    });

    // User's email
    entries.push({
      userId,
      word: email,
      isCorrection: false,
      createdAt: now - 4,
    });

    await Promise.all(
      entries.map((entry) => ctx.db.insert("dictionaryEntries", entry)),
    );
  },
});
