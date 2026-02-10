import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    salt: v.string(),
    name: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_deviceId", ["deviceId"]),

  sessions: defineTable({
    userId: v.id("users"),
    wordCount: v.number(),
    durationMs: v.number(),
    rawLength: v.number(),
    cleanedLength: v.number(),
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
});
