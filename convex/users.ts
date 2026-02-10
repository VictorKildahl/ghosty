import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreate = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .first();

    if (existing) return existing._id;

    // Create an anonymous user linked to this device
    return await ctx.db.insert("users", {
      email: `device-${deviceId}@ghosttype.local`,
      passwordHash: "",
      salt: "",
      deviceId,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .first();
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const updatePreferences = mutation({
  args: {
    userId: v.id("users"),
    shareTranscripts: v.optional(v.boolean()),
    stylePreferences: v.optional(
      v.object({
        personal: v.string(),
        work: v.string(),
        email: v.string(),
        code: v.string(),
        other: v.string(),
      }),
    ),
  },
  handler: async (ctx, { userId, shareTranscripts, stylePreferences }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const patch: Record<string, unknown> = {};
    if (shareTranscripts !== undefined)
      patch.shareTranscripts = shareTranscripts;
    if (stylePreferences !== undefined)
      patch.stylePreferences = stylePreferences;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }

    return await ctx.db.get(userId);
  },
});

export const getPreferences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      shareTranscripts: user.shareTranscripts ?? false,
      stylePreferences: user.stylePreferences ?? null,
    };
  },
});
