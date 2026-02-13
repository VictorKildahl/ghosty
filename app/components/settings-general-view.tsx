"use client";

import { formatShortcut } from "@/lib/ghost-helpers";
import type {
  GhostwriterSettings,
  GhostwriterSettingsUpdate,
} from "@/types/ghostwriter";
import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL } from "@/types/models";
import { useCallback, useEffect, useState } from "react";
import { ToggleRow } from "./settings-toggle-row";

export type SettingsGeneralViewProps = {
  settings: GhostwriterSettings | null;
  isAdmin: boolean;
  onUpdateSettings: (patch: GhostwriterSettingsUpdate) => void;
};

export function SettingsGeneralView({
  settings,
  isAdmin,
  onUpdateSettings,
}: SettingsGeneralViewProps) {
  const [shortcutCapture, setShortcutCapture] = useState(false);
  const [capturePreview, setCapturePreview] = useState("Press new shortcut...");
  const [toggleShortcutCapture, setToggleShortcutCapture] = useState(false);
  const [toggleCapturePreview, setToggleCapturePreview] = useState(
    "Press new shortcut...",
  );

  useEffect(() => {
    if (!window.ghostwriter) return;

    const unsubSettings = window.ghostwriter.onSettings(() => {
      setShortcutCapture(false);
      setCapturePreview("Press new shortcut...");
      setToggleShortcutCapture(false);
      setToggleCapturePreview("Press new shortcut...");
    });

    const unsubPreview = window.ghostwriter.onShortcutPreview((preview) => {
      setCapturePreview(preview);
      setToggleCapturePreview(preview);
    });

    return () => {
      unsubSettings();
      unsubPreview();
    };
  }, []);

  const beginShortcutCapture = useCallback(async () => {
    if (!window.ghostwriter) return;
    try {
      await window.ghostwriter.startShortcutCapture("shortcut");
      setShortcutCapture(true);
      setCapturePreview("Press new shortcut...");
    } catch {
      // ignore
    }
  }, []);

  const endShortcutCapture = useCallback(async () => {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopShortcutCapture();
    setShortcutCapture(false);
    setCapturePreview("Press new shortcut...");
  }, []);

  const beginToggleShortcutCapture = useCallback(async () => {
    if (!window.ghostwriter) return;
    try {
      await window.ghostwriter.startShortcutCapture("toggleShortcut");
      setToggleShortcutCapture(true);
      setToggleCapturePreview("Press new shortcut...");
    } catch {
      // ignore
    }
  }, []);

  const endToggleShortcutCapture = useCallback(async () => {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopShortcutCapture();
    setToggleShortcutCapture(false);
    setToggleCapturePreview("Press new shortcut...");
  }, []);
  return (
    <div className="flex flex-col divide-y divide-border">
      {/* Hold-to-ghost shortcut */}
      <div className="py-5">
        <p className="text-sm font-medium text-ink">Hold-to-ghost shortcut</p>
        <div className="mt-2 flex items-center gap-2">
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
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition hover:bg-sidebar hover:text-ink hover:cursor-pointer"
              onClick={() => onUpdateSettings({ shortcut: null })}
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Hold down this shortcut to ghost, release to stop.
        </p>
      </div>

      {/* Toggle-to-ghost shortcut */}
      <div className="py-5">
        <p className="text-sm font-medium text-ink">Toggle-to-ghost shortcut</p>
        <div className="mt-2 flex items-center gap-2">
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
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition hover:bg-sidebar hover:text-ink hover:cursor-pointer"
              onClick={() => onUpdateSettings({ toggleShortcut: null })}
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Press once to start ghosting, press again to stop.
        </p>
      </div>

      {/* Auto-paste */}
      <ToggleRow
        label="Auto-paste ghosted text"
        description="Automatically paste cleaned text into the active field."
        value={settings?.autoPaste ?? true}
        onToggle={() =>
          onUpdateSettings({ autoPaste: !(settings?.autoPaste ?? true) })
        }
      />

      {/* AI cleanup */}
      <ToggleRow
        label="AI cleanup"
        description="Use an AI model to clean up raw transcription."
        value={settings?.aiCleanup ?? true}
        onToggle={() =>
          onUpdateSettings({ aiCleanup: !(settings?.aiCleanup ?? true) })
        }
      />

      {/* AI model (admin only) */}
      {isAdmin && (
        <div className="py-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">AI model</span>
            <select
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40 hover:cursor-pointer"
              value={settings?.aiModel ?? DEFAULT_AI_MODEL}
              disabled={!(settings?.aiCleanup ?? true)}
              onChange={(event) =>
                onUpdateSettings({ aiModel: event.target.value })
              }
            >
              {AI_MODEL_OPTIONS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Faster models reduce latency between speaking and pasting.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
