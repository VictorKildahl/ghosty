"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type {
  GhostwriterSettings,
  GhostwriterSettingsUpdate,
  StylePreferences,
} from "../types/ghostwriter";
import type {
  SelectableTranscriptionLanguage,
  TranscriptionLanguage,
} from "../types/languages";

/**
 * Keeps the Convex user record in sync with local settings for
 * sharing, style, and language preferences.
 *
 * - On mount (login), loads cloud prefs and patches local settings if the
 *   cloud has data the local file doesn't yet know about (e.g. logged in
 *   on a new device).
 * - Whenever local settings change, pushes tracked preference fields
 *   to the Convex user record.
 */
export function usePreferencesSync(userId: Id<"users"> | null) {
  const updatePreferences = useMutation(api.users.updatePreferences);
  const cloudPrefs = useQuery(
    api.users.getPreferences,
    userId ? { userId } : "skip",
  );

  // Track whether we've already hydrated from the cloud this session
  const hydratedRef = useRef(false);

  useEffect(() => {
    hydratedRef.current = false;
  }, [userId]);

  // ── Hydrate local settings from cloud on first load ────────────────
  useEffect(() => {
    if (!userId || !cloudPrefs || hydratedRef.current) return;
    if (!window.ghostwriter) return;

    hydratedRef.current = true;

    const patch: GhostwriterSettingsUpdate = {};
    if (typeof cloudPrefs.shareTranscripts === "boolean") {
      patch.shareTranscripts = cloudPrefs.shareTranscripts;
    }
    if (cloudPrefs.stylePreferences) {
      patch.stylePreferences = cloudPrefs.stylePreferences as StylePreferences;
    }
    if (typeof cloudPrefs.transcriptionLanguage === "string") {
      patch.transcriptionLanguage =
        cloudPrefs.transcriptionLanguage as TranscriptionLanguage;
    }
    if (Array.isArray(cloudPrefs.transcriptionLanguages)) {
      patch.transcriptionLanguages =
        cloudPrefs.transcriptionLanguages as SelectableTranscriptionLanguage[];
    }

    if (Object.keys(patch).length === 0) return;
    window.ghostwriter.updateSettings(patch).catch(() => undefined);
  }, [userId, cloudPrefs]);

  // ── Push local → cloud whenever settings change ────────────────────
  useEffect(() => {
    if (!userId || !window.ghostwriter) return;

    const unsubscribe = window.ghostwriter.onSettings(
      (settings: GhostwriterSettings) => {
        updatePreferences({
          userId,
          shareTranscripts: settings.shareTranscripts,
          stylePreferences: settings.stylePreferences,
          transcriptionLanguage: settings.transcriptionLanguage,
          transcriptionLanguages: settings.transcriptionLanguages,
        }).catch(() => undefined);
      },
    );

    return unsubscribe;
  }, [userId, updatePreferences]);
}
