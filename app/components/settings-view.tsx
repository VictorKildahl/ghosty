"use client";

import { formatShortcut } from "@/lib/ghost-helpers";
import { cn } from "@/lib/utils";
import type {
  AudioDevice,
  DisplayInfo,
  GhosttypeSettings,
} from "@/types/ghosttype";
import { AI_MODEL_OPTIONS } from "@/types/models";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageLayout } from "./page-layout";

type SettingsError = string | null;

export function SettingsView() {
  const [settings, setSettings] = useState<GhosttypeSettings | null>(null);
  const [settingsError, setSettingsError] = useState<SettingsError>(null);
  const [apiReady, setApiReady] = useState(false);
  const [shortcutCapture, setShortcutCapture] = useState(false);
  const [capturePreview, setCapturePreview] = useState("Press new shortcut...");
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [defaultDeviceName, setDefaultDeviceName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!window.ghosttype) {
      setApiReady(false);
      return;
    }
    setApiReady(true);

    window.ghosttype
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);
    window.ghosttype
      .getAudioDevices()
      .then(setAudioDevices)
      .catch(() => undefined);
    window.ghosttype
      .getDisplays()
      .then(setDisplays)
      .catch(() => undefined);
    window.ghosttype
      .getDefaultInputDevice()
      .then(setDefaultDeviceName)
      .catch(() => undefined);

    const unsubscribeSettings = window.ghosttype.onSettings((next) => {
      setSettings(next);
      setShortcutCapture(false);
      setCapturePreview("Press new shortcut...");
    });
    const unsubscribePreview = window.ghosttype.onShortcutPreview((preview) => {
      setCapturePreview(preview);
    });

    return () => {
      unsubscribeSettings();
      unsubscribePreview();
    };
  }, []);

  async function updateSettings(patch: {
    autoPaste?: boolean;
    selectedMicrophone?: string | null;
    aiCleanup?: boolean;
    aiModel?: string;
    shareTranscripts?: boolean;
    overlayDisplayId?: number | null;
  }) {
    if (!window.ghosttype) return;
    try {
      const next = await window.ghosttype.updateSettings(patch);
      setSettings(next);
      setSettingsError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save settings.";
      setSettingsError(message);
    }
  }

  async function beginShortcutCapture() {
    if (!window.ghosttype) return;
    try {
      await window.ghosttype.startShortcutCapture();
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
    if (!window.ghosttype) return;
    await window.ghosttype.stopShortcutCapture();
    setShortcutCapture(false);
    setCapturePreview("Press new shortcut...");
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
    if (!window.ghosttype) return;
    // Use whichever mic is currently shown in the dropdown (may differ from saved setting).
    const mic = settings?.selectedMicrophone ?? null;
    await window.ghosttype.startMicTest(mic);
    setMicTesting(true);
    rawLevel.current = 0;
    smoothedLevel.current = 0;
    rafId.current = requestAnimationFrame(tickLevel);
  }

  async function stopMicTest() {
    if (!window.ghosttype) return;
    await window.ghosttype.stopMicTest();
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
    if (!window.ghosttype) return;
    const unsub = window.ghosttype.onMicLevel((level) => {
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
      window.ghosttype?.stopMicTest().catch(() => undefined);
    };
  }, []);

  return (
    <PageLayout title="Settings" subtitle="Configure how GhostWriter works.">
      <div className="flex flex-col divide-y divide-border">
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

        {/* Ghosting shortcut */}
        <div className="py-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">Ghosting shortcut</span>
            <input
              className="ghosttype-code rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
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
                  : formatShortcut(settings?.shortcut ?? null)
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
            <span className="text-xs text-muted">
              Click the field, then press the keys you want to use.
            </span>
          </label>
        </div>

        {/* Microphone */}
        <div className="py-5">
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

        {/* AI Model */}
        <div className="py-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">AI model</span>
            <select
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40 hover:cursor-pointer"
              value={settings?.aiModel ?? "openai/gpt-4o-mini"}
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

        {settingsError && (
          <p className="text-xs text-ember py-5">{settingsError}</p>
        )}
      </div>
    </PageLayout>
  );
}
