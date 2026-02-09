"use client";

import { cn } from "@/lib/utils";
import type {
  AudioDevice,
  GhostingShortcut,
  GhostingState,
  GhosttypeSettings,
} from "@/types/ghosttype";
import { AI_MODEL_OPTIONS } from "@/types/models";
import { useEffect, useState } from "react";

type SettingsError = string | null;
type View = "home" | "settings";

type GhostLogEntry = {
  timestamp: Date;
  text: string;
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

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(date: Date) {
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function groupByDate(entries: GhostLogEntry[]) {
  const groups: { date: string; entries: GhostLogEntry[] }[] = [];
  for (const entry of entries) {
    const dateStr = formatDateHeader(entry.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.date === dateStr) {
      last.entries.push(entry);
    } else {
      groups.push({ date: dateStr, entries: [entry] });
    }
  }
  return groups;
}

/* ─── Sidebar ─── */
function Sidebar({
  currentView,
  onNavigate,
}: {
  currentView: View;
  onNavigate: (view: View) => void;
}) {
  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="assets/ghosty.png" alt="Ghosty" className="h-7 w-7" />
        <span className="text-base font-semibold text-ink">Ghosty</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        <button
          onClick={() => onNavigate("home")}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
            currentView === "home"
              ? "bg-white text-ink shadow-xs"
              : "text-muted hover:bg-white/60 hover:text-ink",
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
          Home
        </button>
      </nav>

      {/* Bottom: Settings */}
      <div className="px-3 pb-4">
        <button
          onClick={() => onNavigate("settings")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
            currentView === "settings"
              ? "bg-white text-ink shadow-xs"
              : "text-muted hover:bg-white/60 hover:text-ink",
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}

/* ─── Home View ─── */
function HomeView({
  state,
  settings,
  log,
}: {
  state: GhostingState;
  settings: GhosttypeSettings | null;
  log: GhostLogEntry[];
}) {
  const wordCount = log.reduce(
    (sum, entry) => sum + entry.text.split(/\s+/).filter(Boolean).length,
    0,
  );

  const groups = groupByDate(log);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header with stats */}
      <header className="border-b border-border px-8 pt-8 pb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-ink">Welcome back</h1>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <span>🔥</span>
              <span className="font-medium text-ink">
                {log.length > 0 ? "1 day" : "0 days"}
              </span>
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5">
              <span>🚀</span>
              <span className="font-medium text-ink">{wordCount} words</span>
            </span>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-5 flex h-36 items-center justify-center rounded-xl bg-sidebar">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted">
              {state.phase === "idle" ? (
                <>
                  Hold{" "}
                  <span className="ghosttype-code font-medium text-ghosty">
                    {formatShortcut(settings?.shortcut ?? null) ||
                      "Cmd + Shift + Space"}
                  </span>{" "}
                  to ghost
                </>
              ) : state.phase === "recording" ||
                state.phase === "transcribing" ? (
                <span className="font-medium text-ghosty">Ghosting…</span>
              ) : state.phase === "cleaning" ? (
                <span className="font-medium text-ghosty">Cleaning up…</span>
              ) : state.phase === "error" ? (
                <span className="font-medium text-ember">
                  {state.error || "Something went wrong"}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      {/* Activity log */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {groups.length === 0 ? (
          <p className="text-sm text-muted">
            No ghosted text yet. Start ghosting to see your activity here.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="mb-6">
              <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
                {group.date}
              </p>
              <div className="divide-y divide-border">
                {group.entries.map((entry, i) => (
                  <div key={i} className="flex gap-6 py-3 text-sm">
                    <span className="w-20 shrink-0 text-muted">
                      {formatTime(entry.timestamp)}
                    </span>
                    <p className="text-ink">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Settings View ─── */
function SettingsView({
  settings,
  settingsError,
  shortcutCapture,
  capturePreview,
  audioDevices,
  apiReady,
  onUpdateSettings,
  onBeginShortcutCapture,
  onEndShortcutCapture,
}: {
  settings: GhosttypeSettings | null;
  settingsError: SettingsError;
  shortcutCapture: boolean;
  capturePreview: string;
  audioDevices: AudioDevice[];
  apiReady: boolean;
  onUpdateSettings: (patch: {
    autoPaste?: boolean;
    selectedMicrophone?: string | null;
    aiCleanup?: boolean;
    aiModel?: string;
  }) => void;
  onBeginShortcutCapture: () => void;
  onEndShortcutCapture: () => void;
}) {
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
              onUpdateSettings({ autoPaste: !(settings?.autoPaste ?? true) })
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
              onUpdateSettings({ aiCleanup: !(settings?.aiCleanup ?? true) })
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
              onFocus={onBeginShortcutCapture}
              onBlur={onEndShortcutCapture}
              onMouseDown={(event) => {
                if (shortcutCapture) return;
                event.preventDefault();
                onBeginShortcutCapture();
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
                onUpdateSettings({
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
                onUpdateSettings({ aiModel: event.target.value })
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

        {settingsError && <p className="text-xs text-ember">{settingsError}</p>}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function Page() {
  const [view, setView] = useState<View>("home");
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
  const [ghostLog, setGhostLog] = useState<GhostLogEntry[]>([]);

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

  // Track ghosted text in the log
  useEffect(() => {
    if (state.lastGhostedText) {
      setGhostLog((prev) => {
        // Avoid duplicating the same text at the top
        if (prev.length > 0 && prev[0].text === state.lastGhostedText)
          return prev;
        return [
          { timestamp: new Date(), text: state.lastGhostedText },
          ...prev,
        ];
      });
    }
  }, [state.lastGhostedText]);

  async function updateSettings(patch: {
    autoPaste?: boolean;
    selectedMicrophone?: string | null;
    aiCleanup?: boolean;
    aiModel?: string;
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
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar currentView={view} onNavigate={setView} />
      {view === "home" ? (
        <HomeView state={state} settings={settings} log={ghostLog} />
      ) : (
        <SettingsView
          settings={settings}
          settingsError={settingsError}
          shortcutCapture={shortcutCapture}
          capturePreview={capturePreview}
          audioDevices={audioDevices}
          apiReady={apiReady}
          onUpdateSettings={updateSettings}
          onBeginShortcutCapture={beginShortcutCapture}
          onEndShortcutCapture={endShortcutCapture}
        />
      )}
    </div>
  );
}
