"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatShortcut } from "@/lib/ghost-helpers";
import { cn } from "@/lib/utils";
import type {
  AudioDevice,
  DisplayInfo,
  GhostwriterSettings,
} from "@/types/ghostwriter";
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE,
  VISIBLE_TRANSCRIPTION_LANGUAGES,
  type TranscriptionLanguage,
} from "@/types/languages";
import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL } from "@/types/models";
import { useMutation, useQuery } from "convex/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { PageLayout } from "./page-layout";

type SettingsError = string | null;

type SettingsViewProps = {
  isAdmin: boolean;
  userId: Id<"users">;
  onAccountDeleted: () => void;
};

export function SettingsView({
  isAdmin,
  userId,
  onAccountDeleted,
}: SettingsViewProps) {
  const [settings, setSettings] = useState<GhostwriterSettings | null>(null);
  const [settingsError, setSettingsError] = useState<SettingsError>(null);
  const [apiReady, setApiReady] = useState(false);
  const [shortcutCapture, setShortcutCapture] = useState(false);
  const [capturePreview, setCapturePreview] = useState("Press new shortcut...");
  const [toggleShortcutCapture, setToggleShortcutCapture] = useState(false);
  const [toggleCapturePreview, setToggleCapturePreview] = useState(
    "Press new shortcut...",
  );
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [defaultDeviceName, setDefaultDeviceName] = useState<string | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [problemMessage, setProblemMessage] = useState("");
  const [problemDetails, setProblemDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const profile = useQuery(api.users.getProfile, { userId });
  const updateProfileMutation = useMutation(api.users.updateProfile);
  const deleteAccountMutation = useMutation(api.users.deleteAccount);
  const reportProblemMutation = useMutation(api.users.reportProblem);

  useEffect(() => {
    if (!window.ghostwriter) {
      setApiReady(false);
      return;
    }
    setApiReady(true);

    window.ghostwriter
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);
    window.ghostwriter
      .getAudioDevices()
      .then(setAudioDevices)
      .catch(() => undefined);
    window.ghostwriter
      .getDisplays()
      .then(setDisplays)
      .catch(() => undefined);
    window.ghostwriter
      .getDefaultInputDevice()
      .then(setDefaultDeviceName)
      .catch(() => undefined);

    const unsubscribeSettings = window.ghostwriter.onSettings((next) => {
      setSettings(next);
      setShortcutCapture(false);
      setCapturePreview("Press new shortcut...");
      setToggleShortcutCapture(false);
      setToggleCapturePreview("Press new shortcut...");
    });
    const unsubscribePreview = window.ghostwriter.onShortcutPreview(
      (preview) => {
        setCapturePreview(preview);
        setToggleCapturePreview(preview);
      },
    );

    return () => {
      unsubscribeSettings();
      unsubscribePreview();
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setProfileImageUrl(profile.profileImageUrl ?? "");
  }, [profile]);

  async function updateSettings(patch: {
    autoPaste?: boolean;
    selectedMicrophone?: string | null;
    transcriptionLanguage?: TranscriptionLanguage;
    soundEffectsEnabled?: boolean;
    showInTray?: boolean;
    showInDock?: boolean;
    openAtLogin?: boolean;
    aiCleanup?: boolean;
    aiModel?: string;
    shareTranscripts?: boolean;
    overlayDisplayId?: number | null;
    autoDictionary?: boolean;
    shortcut?: null;
  }) {
    if (!window.ghostwriter) return;
    try {
      const next = await window.ghostwriter.updateSettings(patch);
      setSettings(next);
      setSettingsError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save settings.";
      setSettingsError(message);
    }
  }

  async function readImageAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = typeof reader.result === "string" ? reader.result : null;
        if (!value) {
          reject(new Error("Could not read image file."));
          return;
        }
        resolve(value);
      };
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function onProfileImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 1_500_000) {
      setProfileError("Profile image must be 1.5MB or smaller.");
      return;
    }

    try {
      const dataUrl = await readImageAsDataUrl(file);
      setProfileImageUrl(dataUrl);
      setProfileError(null);
      setProfileMessage(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load image.";
      setProfileError(message);
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await updateProfileMutation({
        userId,
        firstName,
        lastName,
        profileImageUrl,
      });
      setProfileMessage("Account profile updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update profile.";
      setProfileError(message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      "Delete your account permanently? This removes your profile, sessions, dictionary, snippets, and usage history.",
    );
    if (!confirmed) return;

    const phrase = window.prompt("Type DELETE to confirm account deletion.");
    if (phrase !== "DELETE") {
      setProfileError("Account deletion cancelled.");
      return;
    }

    setDeletingAccount(true);
    setProfileError(null);
    try {
      await deleteAccountMutation({ userId });
      onAccountDeleted();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete account.";
      setProfileError(message);
      setDeletingAccount(false);
    }
  }

  async function submitProblemReport() {
    setReportSubmitting(true);
    setReportError(null);
    setReportStatus(null);

    try {
      let details = problemDetails.trim();
      if (window.ghostwriter) {
        try {
          const deviceId = await window.ghostwriter.getDeviceId();
          if (deviceId) {
            details = `${details}\n\nDevice ID: ${deviceId}`.trim();
          }
        } catch {
          // Best effort only.
        }
      }

      await reportProblemMutation({
        userId,
        message: problemMessage,
        details: details || undefined,
      });

      setProblemMessage("");
      setProblemDetails("");
      setReportStatus("Thanks — your report has been submitted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to submit report.";
      setReportError(message);
    } finally {
      setReportSubmitting(false);
    }
  }

  async function toggleTrayVisibility() {
    const currentTray = settings?.showInTray ?? true;
    const currentDock = settings?.showInDock ?? true;
    const nextTray = !currentTray;

    if (!nextTray && !currentDock) {
      setSettingsError(
        "GhostWriter must stay visible in either the tray or the dock.",
      );
      return;
    }

    await updateSettings({ showInTray: nextTray });
  }

  async function toggleDockVisibility() {
    const currentTray = settings?.showInTray ?? true;
    const currentDock = settings?.showInDock ?? true;
    const nextDock = !currentDock;

    if (!nextDock && !currentTray) {
      setSettingsError(
        "GhostWriter must stay visible in either the tray or the dock.",
      );
      return;
    }

    await updateSettings({ showInDock: nextDock });
  }

  async function toggleOpenAtLogin() {
    await updateSettings({ openAtLogin: !(settings?.openAtLogin ?? false) });
  }

  async function beginShortcutCapture() {
    if (!window.ghostwriter) return;
    try {
      await window.ghostwriter.startShortcutCapture("shortcut");
      setShortcutCapture(true);
      setCapturePreview("Press new shortcut...");
      setSettingsError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start shortcut capture.";
      setSettingsError(message);
    }
  }

  async function endShortcutCapture() {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopShortcutCapture();
    setShortcutCapture(false);
    setCapturePreview("Press new shortcut...");
  }

  async function beginToggleShortcutCapture() {
    if (!window.ghostwriter) return;
    try {
      await window.ghostwriter.startShortcutCapture("toggleShortcut");
      setToggleShortcutCapture(true);
      setToggleCapturePreview("Press new shortcut...");
      setSettingsError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start shortcut capture.";
      setSettingsError(message);
    }
  }

  async function endToggleShortcutCapture() {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopShortcutCapture();
    setToggleShortcutCapture(false);
    setToggleCapturePreview("Press new shortcut...");
  }

  async function clearToggleShortcut() {
    if (!window.ghostwriter) return;
    try {
      const next = await window.ghostwriter.updateSettings({
        toggleShortcut: null,
      });
      setSettings(next);
      setSettingsError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save settings.";
      setSettingsError(message);
    }
  }

  async function clearShortcut() {
    if (!window.ghostwriter) return;
    try {
      const next = await window.ghostwriter.updateSettings({
        shortcut: null,
      });
      setSettings(next);
      setSettingsError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save settings.";
      setSettingsError(message);
    }
  }

  /* ---- Mic test ---- */
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const smoothedLevel = useRef(0);
  const rafId = useRef<number | null>(null);
  const rawLevel = useRef(0);

  // Smooth the level meter using requestAnimationFrame for fluid animation.
  const tickLevel = useCallback(() => {
    const target = rawLevel.current;
    // Faster attack, slower release – feels natural.
    const alpha = target > smoothedLevel.current ? 0.35 : 0.12;
    smoothedLevel.current += (target - smoothedLevel.current) * alpha;
    setMicLevel(smoothedLevel.current);
    rafId.current = requestAnimationFrame(tickLevel);
  }, []);

  async function startMicTest() {
    if (!window.ghostwriter) return;
    // Use whichever mic is currently shown in the dropdown (may differ from saved setting).
    const mic = settings?.selectedMicrophone ?? null;
    await window.ghostwriter.startMicTest(mic);
    setMicTesting(true);
    rawLevel.current = 0;
    smoothedLevel.current = 0;
    rafId.current = requestAnimationFrame(tickLevel);
  }

  async function stopMicTest() {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopMicTest();
    setMicTesting(false);
    rawLevel.current = 0;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    setMicLevel(0);
  }

  // Subscribe to mic-level events from main process.
  useEffect(() => {
    if (!window.ghostwriter) return;
    const unsub = window.ghostwriter.onMicLevel((level) => {
      rawLevel.current = level;
    });
    return () => {
      unsub();
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, []);

  // Ensure mic test is stopped when component unmounts.
  useEffect(() => {
    return () => {
      window.ghostwriter?.stopMicTest().catch(() => undefined);
    };
  }, []);

  const accountInitials = `${firstName.trim().charAt(0)}${lastName
    .trim()
    .charAt(0)}`
    .trim()
    .toUpperCase();

  return (
    <PageLayout title="Settings" subtitle="Configure how GhostWriter works.">
      <div className="flex flex-col divide-y divide-border">
        {/* Account profile */}
        <div className="py-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10 text-base font-semibold text-accent">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  accountInitials || "?"
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink transition hover:bg-sidebar hover:cursor-pointer">
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onProfileImageSelected}
                  />
                </label>
                {profileImageUrl && (
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition hover:bg-sidebar hover:text-ink hover:cursor-pointer"
                    onClick={() => setProfileImageUrl("")}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">First name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
                  className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Last name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last name"
                  className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveProfile}
                disabled={profileSaving || deletingAccount}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-50 hover:cursor-pointer"
              >
                {profileSaving ? "Saving..." : "Save account"}
              </button>

              <button
                type="button"
                onClick={deleteAccount}
                disabled={profileSaving || deletingAccount}
                className="rounded-lg bg-ember/10 px-3 py-2 text-xs font-medium text-ember transition hover:bg-ember/20 disabled:opacity-50 hover:cursor-pointer"
              >
                {deletingAccount ? "Deleting..." : "Delete account permanently"}
              </button>
            </div>

            {profileMessage && (
              <p className="text-xs text-accent">{profileMessage}</p>
            )}
            {profileError && (
              <p className="text-xs text-ember">{profileError}</p>
            )}
          </div>
        </div>

        {/* Auto-paste */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">
              Auto-paste ghosted text
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Automatically paste cleaned text into the active field.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.autoPaste ?? true}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.autoPaste ?? true) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={() =>
              updateSettings({ autoPaste: !(settings?.autoPaste ?? true) })
            }
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                settings?.autoPaste ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Show in tray */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">Show in tray</p>
            <p className="mt-0.5 text-xs text-muted">
              Keep GhostWriter available from the macOS menu bar.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.showInTray ?? true}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.showInTray ?? true) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={toggleTrayVisibility}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                (settings?.showInTray ?? true)
                  ? "translate-x-5"
                  : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Show in dock */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">Show in dock</p>
            <p className="mt-0.5 text-xs text-muted">
              Display GhostWriter as a normal app icon in the dock.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.showInDock ?? true}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.showInDock ?? true) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={toggleDockVisibility}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                (settings?.showInDock ?? true)
                  ? "translate-x-5"
                  : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Open on macOS boot */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">Open on macOS boot</p>
            <p className="mt-0.5 text-xs text-muted">
              Automatically start GhostWriter when you log in.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.openAtLogin ?? false}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.openAtLogin ?? false) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={toggleOpenAtLogin}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                (settings?.openAtLogin ?? false)
                  ? "translate-x-5"
                  : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Sound effects */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">Sound effects</p>
            <p className="mt-0.5 text-xs text-muted">
              Play a short sound when ghosting starts and stops.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.soundEffectsEnabled ?? true}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.soundEffectsEnabled ?? true) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={() =>
              updateSettings({
                soundEffectsEnabled: !(settings?.soundEffectsEnabled ?? true),
              })
            }
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                (settings?.soundEffectsEnabled ?? true)
                  ? "translate-x-5"
                  : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* AI cleanup */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">AI cleanup</p>
            <p className="mt-0.5 text-xs text-muted">
              Use an AI model to clean up the raw transcription.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.aiCleanup ?? true}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.aiCleanup ?? true) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={() =>
              updateSettings({ aiCleanup: !(settings?.aiCleanup ?? true) })
            }
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                settings?.aiCleanup ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Auto-dictionary */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">
              Auto-learn corrections
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Automatically add words to the dictionary when you edit ghosted
              text.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.autoDictionary ?? true}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.autoDictionary ?? true) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={() =>
              updateSettings({
                autoDictionary: !(settings?.autoDictionary ?? true),
              })
            }
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                (settings?.autoDictionary ?? true)
                  ? "translate-x-5"
                  : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Share transcripts */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium text-ink">
              Help improve GhostWriter
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Share your transcriptions anonymously to help us improve accuracy.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.shareTranscripts ?? false}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
            style={{
              backgroundColor:
                (settings?.shareTranscripts ?? false) ? "#6944AE" : "#d4d4d4",
            }}
            onClick={() =>
              updateSettings({
                shareTranscripts: !(settings?.shareTranscripts ?? false),
              })
            }
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                settings?.shareTranscripts
                  ? "translate-x-5"
                  : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Ghosting shortcut (hold) */}
        <div className="py-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">Hold-to-ghost shortcut</span>
            <div className="flex items-center gap-2">
              <input
                className="ghostwriter-code flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                style={
                  shortcutCapture
                    ? {
                        borderColor: "#6944AE",
                        backgroundColor: "rgba(105, 68, 174, 0.1)",
                      }
                    : {}
                }
                value={
                  shortcutCapture
                    ? capturePreview
                    : settings?.shortcut
                      ? formatShortcut(settings.shortcut)
                      : "Not set"
                }
                placeholder="Press shortcut"
                readOnly
                onFocus={beginShortcutCapture}
                onBlur={endShortcutCapture}
                onMouseDown={(event) => {
                  if (shortcutCapture) return;
                  event.preventDefault();
                  beginShortcutCapture();
                }}
              />
              {settings?.shortcut && !shortcutCapture && (
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:text-ink hover:bg-border/50 transition hover:cursor-pointer"
                  onClick={clearShortcut}
                >
                  Clear
                </button>
              )}
            </div>
            <span className="text-xs text-muted">
              Hold down this shortcut to ghost, release to stop. Click the field
              to set a new shortcut.
            </span>
          </label>
        </div>

        {/* Toggle ghosting shortcut */}
        <div className="py-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">
              Toggle-to-ghost shortcut
            </span>
            <div className="flex items-center gap-2">
              <input
                className="ghostwriter-code flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                style={
                  toggleShortcutCapture
                    ? {
                        borderColor: "#6944AE",
                        backgroundColor: "rgba(105, 68, 174, 0.1)",
                      }
                    : {}
                }
                value={
                  toggleShortcutCapture
                    ? toggleCapturePreview
                    : settings?.toggleShortcut
                      ? formatShortcut(settings.toggleShortcut)
                      : "Not set"
                }
                placeholder="Press shortcut"
                readOnly
                onFocus={beginToggleShortcutCapture}
                onBlur={endToggleShortcutCapture}
                onMouseDown={(event) => {
                  if (toggleShortcutCapture) return;
                  event.preventDefault();
                  beginToggleShortcutCapture();
                }}
              />
              {settings?.toggleShortcut && !toggleShortcutCapture && (
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:text-ink hover:bg-border/50 transition hover:cursor-pointer"
                  onClick={clearToggleShortcut}
                >
                  Clear
                </button>
              )}
            </div>
            <span className="text-xs text-muted">
              Press once to start ghosting, press again to stop. You can also
              click the overlay pill to toggle.
            </span>
          </label>
        </div>

        {/* Microphone */}
        <div className="py-5">
          <label className="flex flex-col gap-2 text-sm mb-4">
            <span className="font-medium text-ink">Transcription language</span>
            <select
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 hover:cursor-pointer"
              value={
                settings?.transcriptionLanguage ??
                DEFAULT_TRANSCRIPTION_LANGUAGE
              }
              onChange={(event) =>
                updateSettings({
                  transcriptionLanguage: event.target
                    .value as TranscriptionLanguage,
                })
              }
            >
              {VISIBLE_TRANSCRIPTION_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Pick the language you speak while ghosting.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">Microphone</span>
            <select
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 hover:cursor-pointer"
              value={settings?.selectedMicrophone ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                updateSettings({
                  selectedMicrophone: value === "" ? null : value,
                });
                // Stop any running test so the user re-tests with the new mic.
                if (micTesting) stopMicTest();
              }}
            >
              <option value="">
                {defaultDeviceName
                  ? `System default (${defaultDeviceName})`
                  : "System default (auto-detect)"}
              </option>
              {audioDevices.map((device) => (
                <option key={device.index} value={device.name}>
                  {device.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Select which microphone to use for ghosting.
              {defaultDeviceName && !settings?.selectedMicrophone && (
                <>
                  {" "}
                  Currently using <strong>{defaultDeviceName}</strong>.
                </>
              )}
            </span>
          </label>

          {/* Mic test */}
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              className={cn(
                "self-start rounded-lg px-3 py-1.5 text-xs font-medium transition hover:cursor-pointer",
                micTesting
                  ? "bg-ember/10 text-ember hover:bg-ember/20"
                  : "bg-accent/10 text-accent hover:bg-accent/20",
              )}
              onClick={micTesting ? stopMicTest : startMicTest}
            >
              {micTesting ? "Stop test" : "Test microphone"}
            </button>

            {micTesting && (
              <div className="flex items-center gap-3">
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
                    style={{
                      width: `${Math.min(100, micLevel * 400)}%`,
                      backgroundColor:
                        micLevel * 400 > 80
                          ? "#d6764b"
                          : micLevel * 400 > 40
                            ? "#e6b94d"
                            : "#2f6f5e",
                    }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-muted">
                  {Math.round(Math.min(100, micLevel * 400))}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Overlay display */}
        {displays.length > 1 && (
          <div className="py-5">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-ink">Overlay display</span>
              <select
                className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 hover:cursor-pointer"
                value={settings?.overlayDisplayId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateSettings({
                    overlayDisplayId: value === "" ? null : Number(value),
                  });
                }}
              >
                <option value="">Primary display</option>
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                Choose which screen the overlay appears on.
              </span>
            </label>
          </div>
        )}

        {/* AI Model (admin only) */}
        {isAdmin && (
          <div className="py-5">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-ink">AI model</span>
              <select
                className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40 hover:cursor-pointer"
                value={settings?.aiModel ?? DEFAULT_AI_MODEL}
                disabled={!(settings?.aiCleanup ?? true)}
                onChange={(event) =>
                  updateSettings({ aiModel: event.target.value })
                }
              >
                {AI_MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                Faster models reduce latency between speaking and pasting.
              </span>
            </label>
          </div>
        )}

        {/* Report problem */}
        <div className="py-5">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-ink">Report a problem</p>
            <p className="text-xs text-muted">
              Tell us what went wrong and include reproduction steps if you can.
            </p>

            <textarea
              value={problemMessage}
              onChange={(event) => setProblemMessage(event.target.value)}
              placeholder="What happened?"
              rows={3}
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />

            <textarea
              value={problemDetails}
              onChange={(event) => setProblemDetails(event.target.value)}
              placeholder="Optional: steps to reproduce, expected vs actual behavior"
              rows={4}
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />

            <button
              type="button"
              onClick={submitProblemReport}
              disabled={reportSubmitting || problemMessage.trim().length < 10}
              className="self-start rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-50 hover:cursor-pointer"
            >
              {reportSubmitting ? "Submitting..." : "Send report"}
            </button>

            {reportStatus && (
              <p className="text-xs text-accent">{reportStatus}</p>
            )}
            {reportError && <p className="text-xs text-ember">{reportError}</p>}
          </div>
        </div>

        {settingsError && (
          <p className="text-xs text-ember py-5">{settingsError}</p>
        )}
      </div>
    </PageLayout>
  );
}
