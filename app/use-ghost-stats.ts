"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type {
  GhosttypeSettings,
  LocalTranscript,
  SessionEvent,
} from "../types/ghosttype";

export function useGhostStats(userId: Id<"users"> | null) {
  const recordSession = useMutation(api.sessions.record);
  const [shareTranscripts, setShareTranscripts] = useState(false);
  const [localTranscripts, setLocalTranscripts] = useState<LocalTranscript[]>(
    [],
  );

  // Query stats (only when userId is available)
  const stats = useQuery(api.stats.get, userId ? { userId } : "skip");

  // Load local transcripts and track settings
  useEffect(() => {
    if (!window.ghosttype) return;

    window.ghosttype
      .getSettings()
      .then((s: GhosttypeSettings) => setShareTranscripts(s.shareTranscripts))
      .catch(() => undefined);

    window.ghosttype
      .getLocalTranscripts()
      .then(setLocalTranscripts)
      .catch(() => undefined);

    const unsubscribe = window.ghosttype.onSettings((s: GhosttypeSettings) => {
      setShareTranscripts(s.shareTranscripts);
    });

    return unsubscribe;
  }, []);

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
        ...(shareTranscripts
          ? { rawText: session.rawText, cleanedText: session.cleanedText }
          : {}),
      });

      // Refresh local transcripts after a new session
      window.ghosttype
        ?.getLocalTranscripts()
        .then(setLocalTranscripts)
        .catch(() => undefined);
    },
    [userId, recordSession, shareTranscripts],
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
    localTranscripts,
  };
}
