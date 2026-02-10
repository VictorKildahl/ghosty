"use client";

import { formatShortcut } from "@/lib/ghost-helpers";
import { cn } from "@/lib/utils";
import type { AudioDevice, GhosttypeSettings } from "@/types/ghosttype";
import { AI_MODEL_OPTIONS } from "@/types/models";
import { useEffect, useState } from "react";

type SettingsError = string | null;

export function SettingsView() {
  const [settings, setSettings] = useState<GhosttypeSettings | null>(null);
  const [settingsError, setSettingsError] = useState<SettingsError>(null);
  const [apiReady, setApiReady] = useState(false);
  const [shortcutCapture, setShortcutCapture] = useState(false);
  const [capturePreview, setCapturePreview] = useState("Press new shortcut...");
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);

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

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-8 pt-8 pb-6">
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Configure how GhostType works.
        </p>
        {!apiReady && (
          <p className="mt-2 text-xs text-ember">
            IPC bridge unavailable. Is the preload running?
          </p>
        )}
      </header>

      <div className="flex flex-col gap-6 px-8 py-6">
        {/* Auto-paste */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
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
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
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

        {/* AI cleanup */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
          <div>
            <p className="text-sm font-medium text-ink">AI cleanup</p>
            <p className="mt-0.5 text-xs text-muted">
              Use an AI model to clean up the raw transcription.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.aiCleanup ?? true}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
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

        {/* Ghosting shortcut */}
        <div className="rounded-xl border border-border bg-white p-4">
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
        <div className="rounded-xl border border-border bg-white p-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">Microphone</span>
            <select
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
              value={settings?.selectedMicrophone ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                updateSettings({
                  selectedMicrophone: value === "" ? null : value,
                });
              }}
            >
              <option value="">Default (device :0)</option>
              {audioDevices.map((device) => (
                <option key={device.index} value={device.name}>
                  {device.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Select which microphone to use for ghosting.
            </span>
          </label>
        </div>

        {/* AI Model */}
        <div className="rounded-xl border border-border bg-white p-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">AI model</span>
            <select
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40"
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
        <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
          <div>
            <p className="text-sm font-medium text-ink">
              Help improve GhostType
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Share your transcriptions anonymously to help us improve accuracy.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings?.shareTranscripts ?? false}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
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

        {settingsError && <p className="text-xs text-ember">{settingsError}</p>}
      </div>
    </div>
  );
}
