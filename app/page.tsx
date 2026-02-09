"use client";

import type {
  AudioDevice,
  GhostingPhase,
  GhostingShortcut,
  GhostingState,
  GhosttypeSettings,
} from "@/types/ghosttype";
import { useEffect, useState } from "react";

type SettingsError = string | null;

const phaseLabels: Record<GhostingPhase, string> = {
  idle: "Idle",
  recording: "Ghosting",
  transcribing: "Transcribing",
  cleaning: "Cleaning",
  error: "Error",
};

function formatShortcut(shortcut: GhostingShortcut | null) {
  if (!shortcut) return "";
  const parts: string[] = [];
  if (shortcut.meta) parts.push("Cmd");
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Opt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key);
  return parts.join(" + ");
}

export default function Page() {
  const [state, setState] = useState<GhostingState>({
    phase: "idle",
    lastGhostedText: "",
    lastRawText: "",
    error: null,
  });
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
      .getState()
      .then(setState)
      .catch(() => undefined);
    window.ghosttype
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);
    window.ghosttype
      .getAudioDevices()
      .then(setAudioDevices)
      .catch(() => undefined);
    const unsubscribeState = window.ghosttype.onGhostingState(setState);
    const unsubscribeSettings = window.ghosttype.onSettings((next) => {
      setSettings(next);
      setShortcutCapture(false);
      setCapturePreview("Press new shortcut...");
    });
    const unsubscribePreview = window.ghosttype.onShortcutPreview((preview) => {
      setCapturePreview(preview);
    });
    return () => {
      unsubscribeState();
      unsubscribeSettings();
      unsubscribePreview();
    };
  }, []);

  const statusTone = (() => {
    if (state.phase === "recording") return "text-moss";
    if (state.phase === "error") return "text-ember";
    return "text-ink";
  })();

  async function updateSettings(patch: { autoPaste?: boolean; selectedMicrophone?: string | null }) {
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
    <section className="ghosttype-surface flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="ghosttype-label">GhostType</p>
        <h1 className="text-2xl font-semibold text-ink">Ghosting Console</h1>
        <p className="text-sm text-ink/70">
          Hold{" "}
          <span className="ghosttype-code">
            {formatShortcut(settings?.shortcut ?? null) ||
              "Cmd + Shift + Space"}
          </span>{" "}
          to ghost. Release to transcribe, clean, and paste.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
          <p className="ghosttype-label">Status</p>
          <p className={`mt-2 text-lg font-semibold ${statusTone}`}>
            {phaseLabels[state.phase]}
          </p>
          {!apiReady && (
            <p className="mt-2 text-xs text-ember">
              IPC bridge unavailable. Is the preload running?
            </p>
          )}
          {state.error && (
            <p className="mt-2 text-xs text-ember">{state.error}</p>
          )}
        </div>

        <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
          <p className="ghosttype-label">Debug Controls</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-parchment transition hover:bg-ink/90"
              onClick={() => window.ghosttype?.startGhosting()}
            >
              Start Ghosting
            </button>
            <button
              className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium text-ink transition hover:bg-ink/10"
              onClick={() => window.ghosttype?.stopGhosting()}
            >
              Stop Ghosting
            </button>
          </div>
          <p className="mt-3 text-xs text-ink/60">
            These controls mirror the global hotkey for quick testing.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white/80 p-4">
        <p className="ghosttype-label">Preferences</p>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 text-sm text-ink">
            <span>Auto-paste ghosted text</span>
            <button
              type="button"
              aria-pressed={settings?.autoPaste ?? true}
              aria-label="Toggle auto-paste ghosted text"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                settings?.autoPaste ? "bg-moss" : "bg-ink/20"
              }`}
              onClick={() =>
                updateSettings({ autoPaste: !(settings?.autoPaste ?? true) })
              }
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  settings?.autoPaste ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <label className="flex flex-col gap-2 text-sm text-ink">
            <span>Microphone</span>
            <select
              className="rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm focus:outline-none"
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
            <span className="text-xs text-ink/60">
              Select which microphone to use for ghosting.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm text-ink">
            <span>Ghosting shortcut</span>
            <input
              className={`ghosttype-code rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                shortcutCapture
                  ? "border-moss bg-moss/10"
                  : "border-ink/20 bg-white"
              }`}
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
                void beginShortcutCapture();
              }}
            />
            <span className="text-xs text-ink/60">
              Click the field, then press the keys you want to use.
            </span>
          </label>

          {settingsError && (
            <p className="text-xs text-ember">{settingsError}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white/80 p-4">
        <p className="ghosttype-label">Last Ghosted Text</p>
        <p className="mt-3 text-sm leading-relaxed text-ink">
          {state.lastGhostedText || "No ghosted text yet."}
        </p>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white/60 p-4">
        <p className="ghosttype-label">Raw Transcription</p>
        <p className="mt-3 text-xs leading-relaxed text-ink/70">
          {state.lastRawText || "Waiting for ghosting."}
        </p>
      </div>
    </section>
  );
}
