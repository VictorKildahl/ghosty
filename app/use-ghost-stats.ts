"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { SessionEvent } from "../types/ghosttype";

export function useGhostStats(userId: Id<"users"> | null) {
  const recordSession = useMutation(api.sessions.record);

  // Query stats (only when userId is available)
  const stats = useQuery(api.stats.get, userId ? { userId } : "skip");

  // Record a session
  const trackSession = useCallback(
    async (session: SessionEvent) => {
      if (!userId) return;
      await recordSession({
        userId,
        wordCount: session.wordCount,
        durationMs: session.durationMs,
        rawLength: session.rawLength,
        cleanedLength: session.cleanedLength,
      });
    },
    [userId, recordSession],
  );

  // Listen for session complete events from main process
  useEffect(() => {
    if (!window.ghosttype || !userId) return;
    const unsubscribe = window.ghosttype.onSessionComplete((session) => {
      trackSession(session).catch(console.error);
    });
    return unsubscribe;
  }, [userId, trackSession]);

  return {
    stats: stats ?? null,
  };
}
