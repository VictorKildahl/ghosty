import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    salt: v.string(),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
    onboardingCompleted: v.optional(v.boolean()),
    emailVerified: v.optional(v.boolean()),
    verificationToken: v.optional(v.string()),
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
    planId: v.optional(v.string()),
    billingCycle: v.optional(v.string()),
    billingStatus: v.optional(v.string()),
    nextBillingDate: v.optional(v.number()),
    createdAt: v.number(),
    // Running token usage totals (updated on every AI call)
    totalTokens: v.optional(v.number()),
    totalInputTokens: v.optional(v.number()),
    totalOutputTokens: v.optional(v.number()),
    totalAiCost: v.optional(v.number()), // USD
    totalAiCalls: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_deviceId", ["deviceId"]),

  dictionaryEntries: defineTable({
    userId: v.id("users"),
    word: v.string(),
    isCorrection: v.boolean(),
    misspelling: v.optional(v.string()),
    autoAdded: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  sessions: defineTable({
    userId: v.id("users"),
    wordCount: v.number(),
    durationMs: v.optional(v.number()),
    rawLength: v.number(),
    cleanedLength: v.number(),
    rawText: v.optional(v.string()),
    cleanedText: v.optional(v.string()),
    appName: v.optional(v.string()), // Frontmost app when transcription was pasted
    timestamp: v.number(),
    date: v.string(), // "YYYY-MM-DD" for easy grouping
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),

  dailyStats: defineTable({
    userId: v.id("users"),
    date: v.string(), // "YYYY-MM-DD"
    wordCount: v.number(),
    sessionCount: v.number(),
    totalDurationMs: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),

  snippetEntries: defineTable({
    userId: v.id("users"),
    snippet: v.string(),
    expansion: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  tokenUsage: defineTable({
    userId: v.id("users"),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCost: v.optional(v.number()), // USD
    timestamp: v.number(),
    date: v.string(), // "YYYY-MM-DD"
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),

  problemReports: defineTable({
    userId: v.id("users"),
    email: v.optional(v.string()),
    message: v.string(),
    details: v.optional(v.string()),
    createdAt: v.number(),
    status: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
});
