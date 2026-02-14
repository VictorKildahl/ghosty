"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type {
  GhostwriterSettings,
  LocalTranscript,
  SessionEvent,
} from "../types/ghostwriter";

/** Return the current date in the user's local timezone as "YYYY-MM-DD". */
function getLocalDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function useGhostStats(userId: Id<"users"> | null) {
  const recordSession = useMutation(api.sessions.record);
  const recordTokenUsage = useMutation(api.tokenUsage.record);
  const deleteSession = useMutation(api.sessions.deleteByTimestamp);
  const [shareTranscripts, setShareTranscripts] = useState(false);
  const [localTranscripts, setLocalTranscripts] = useState<LocalTranscript[]>(
    [],
  );

  // Query stats (only when userId is available)
  const stats = useQuery(
    api.stats.get,
    userId ? { userId, localToday: getLocalDate() } : "skip",
  );

  // Load local transcripts and track settings
  useEffect(() => {
    if (!window.ghostwriter) return;

    window.ghostwriter
      .getSettings()
      .then((s: GhostwriterSettings) => setShareTranscripts(s.shareTranscripts))
      .catch(() => undefined);

    window.ghostwriter
      .getLocalTranscripts()
      .then(setLocalTranscripts)
      .catch(() => undefined);

    const unsubscribe = window.ghostwriter.onSettings(
      (s: GhostwriterSettings) => {
        setShareTranscripts(s.shareTranscripts);
      },
    );

    return unsubscribe;
  }, []);

  // Record a session
  const trackSession = useCallback(
    async (session: SessionEvent) => {
      if (!userId) return;
      const localDate = getLocalDate();
      await recordSession({
        userId,
        wordCount: session.wordCount,
        durationMs: session.durationMs,
        rawLength: session.rawLength,
        cleanedLength: session.cleanedLength,
        localDate,
        ...(session.appName ? { appName: session.appName } : {}),
        ...(shareTranscripts
          ? { rawText: session.rawText, cleanedText: session.cleanedText }
          : {}),
      });

      // Record token usage if AI cleanup was used
      if (session.tokenUsage) {
        await recordTokenUsage({
          userId,
          model: session.tokenUsage.model,
          inputTokens: session.tokenUsage.inputTokens,
          outputTokens: session.tokenUsage.outputTokens,
          estimatedCost: session.tokenUsage.estimatedCost,
          localDate,
        }).catch(() => undefined);
      }

      // Refresh local transcripts after a new session
      window.ghostwriter
        ?.getLocalTranscripts()
        .then(setLocalTranscripts)
        .catch(() => undefined);
    },
    [userId, recordSession, recordTokenUsage, shareTranscripts],
  );

  // Listen for session complete events from main process
  useEffect(() => {
    if (!window.ghostwriter || !userId) return;
    const unsubscribe = window.ghostwriter.onSessionComplete((session) => {
      trackSession(session).catch(console.error);
    });
    return unsubscribe;
  }, [userId, trackSession]);

  // Delete a transcript from local storage and Convex
  const deleteTranscript = useCallback(
    async (timestamp: number) => {
      // Always delete from local file
      await window.ghostwriter?.deleteLocalTranscript(timestamp);

      // Also delete from Convex if user is logged in
      if (userId) {
        await deleteSession({ userId, timestamp }).catch(() => undefined);
      }

      // Refresh local transcripts
      window.ghostwriter
        ?.getLocalTranscripts()
        .then(setLocalTranscripts)
        .catch(() => undefined);
    },
    [userId, deleteSession],
  );

  return {
    stats: stats ?? null,
    localTranscripts,
    deleteTranscript,
  };
}
