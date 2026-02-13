import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function splitName(name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { firstName: undefined, lastName: undefined };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: undefined };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function fullName(firstName?: string, lastName?: string) {
  const first = firstName?.trim() ?? "";
  const last = lastName?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || "";
}

const BILLING_PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Personal use with core ghosting features.",
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    features: [
      "Core voice ghosting",
      "Dictionary and snippets",
      "Local transcript history",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For heavy daily usage and AI cleanup.",
    monthlyPriceCents: 1900,
    yearlyPriceCents: 18000,
    features: [
      "Unlimited AI cleanup",
      "Priority transcription queue",
      "Advanced style controls",
    ],
  },
  {
    id: "team",
    name: "Team",
    description: "Shared governance and analytics for teams.",
    monthlyPriceCents: 4900,
    yearlyPriceCents: 46800,
    features: [
      "Everything in Pro",
      "Team usage visibility",
      "Priority support",
    ],
  },
] as const;

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
      email: `device-${deviceId}@ghostwriter.local`,
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

export const completeOnboarding = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");
    await ctx.db.patch(userId, { onboardingCompleted: true });
  },
});

export const updatePreferences = mutation({
  args: {
    userId: v.id("users"),
    shareTranscripts: v.optional(v.boolean()),
    transcriptionLanguage: v.optional(v.string()),
    transcriptionLanguages: v.optional(v.array(v.string())),
    stylePreferences: v.optional(
      v.object({
        personal: v.string(),
        work: v.string(),
        email: v.string(),
        code: v.optional(v.string()),
        other: v.string(),
      }),
    ),
  },
  handler: async (
    ctx,
    {
      userId,
      shareTranscripts,
      transcriptionLanguage,
      transcriptionLanguages,
      stylePreferences,
    },
  ) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const patch: Record<string, unknown> = {};
    if (shareTranscripts !== undefined)
      patch.shareTranscripts = shareTranscripts;
    if (transcriptionLanguage !== undefined)
      patch.transcriptionLanguage = transcriptionLanguage;
    if (transcriptionLanguages !== undefined)
      patch.transcriptionLanguages = transcriptionLanguages;
    if (stylePreferences !== undefined)
      patch.stylePreferences = stylePreferences;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }

    return await ctx.db.get(userId);
  },
});

export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Fall back to parsing the legacy `name` field when firstName/lastName
    // haven't been explicitly set yet (matches login/validate behaviour).
    const parsed = splitName(user.name);
    const firstName = user.firstName ?? parsed.firstName ?? "";
    const lastName = user.lastName ?? parsed.lastName ?? "";

    return {
      email: user.email,
      firstName,
      lastName,
      profileImageUrl: user.profileImageUrl ?? "",
    };
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    profileImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { userId, firstName, lastName, profileImageUrl }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const patch: Record<string, unknown> = {
      firstName: cleanFirstName,
      lastName: cleanLastName,
      name: fullName(cleanFirstName, cleanLastName),
    };

    if (profileImageUrl !== undefined) {
      patch.profileImageUrl = profileImageUrl.trim();
    }

    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

export const deleteAccount = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const dictionaryEntries = await ctx.db
      .query("dictionaryEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const entry of dictionaryEntries) {
      await ctx.db.delete(entry._id);
    }

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    const dailyStats = await ctx.db
      .query("dailyStats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const stat of dailyStats) {
      await ctx.db.delete(stat._id);
    }

    const snippets = await ctx.db
      .query("snippetEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const snippet of snippets) {
      await ctx.db.delete(snippet._id);
    }

    const tokenUsageRows = await ctx.db
      .query("tokenUsage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const row of tokenUsageRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(userId);
    return { success: true };
  },
});

export const reportProblem = mutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { userId, message, details }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const cleanMessage = message.trim();
    if (cleanMessage.length < 10) {
      throw new Error("Please include a bit more detail in your report.");
    }

    const reportId = await ctx.db.insert("problemReports", {
      userId,
      email: user.email,
      message: cleanMessage,
      details: details?.trim() || undefined,
      createdAt: Date.now(),
      status: "open",
    });

    return { reportId };
  },
});

export const getBillingPlans = query({
  args: {},
  handler: async () => BILLING_PLANS,
});

export const getBillingState = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      planId: user.planId ?? "free",
      billingCycle: user.billingCycle ?? "monthly",
      billingStatus: user.billingStatus ?? "active",
      nextBillingDate: user.nextBillingDate ?? null,
    };
  },
});

export const updateBillingPlan = mutation({
  args: {
    userId: v.id("users"),
    planId: v.string(),
    billingCycle: v.union(v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, { userId, planId, billingCycle }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const plan = BILLING_PLANS.find((item) => item.id === planId);
    if (!plan) throw new Error("Invalid plan.");

    const nextBillingDate =
      planId === "free"
        ? undefined
        : Date.now() +
          (billingCycle === "yearly"
            ? 365 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000);

    await ctx.db.patch(userId, {
      planId,
      billingCycle,
      billingStatus: "active",
      nextBillingDate,
    });

    return await ctx.db.get(userId);
  },
});

export const getPreferences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      shareTranscripts: user.shareTranscripts ?? null,
      transcriptionLanguage: user.transcriptionLanguage ?? null,
      transcriptionLanguages: user.transcriptionLanguages ?? null,
      stylePreferences: user.stylePreferences ?? null,
    };
  },
});
