"use client";

import type {
  DisplayInfo,
  GhostwriterSettings,
  GhostwriterSettingsUpdate,
} from "@/types/ghostwriter";
import { useEffect, useState } from "react";
import { ToggleRow } from "./settings-toggle-row";

export type SettingsSystemViewProps = {
  settings: GhostwriterSettings | null;
  settingsError: string | null;
  onSetSettingsError: (error: string | null) => void;
  onUpdateSettings: (patch: GhostwriterSettingsUpdate) => void;
};

export function SettingsSystemView({
  settings,
  settingsError,
  onSetSettingsError,
  onUpdateSettings,
}: SettingsSystemViewProps) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);

  useEffect(() => {
    if (!window.ghostwriter) return;
    window.ghostwriter
      .getDisplays()
      .then(setDisplays)
      .catch(() => undefined);
  }, []);

  async function toggleTrayVisibility() {
    const currentTray = settings?.showInTray ?? true;
    const currentDock = settings?.showInDock ?? true;
    const nextTray = !currentTray;
    if (!nextTray && !currentDock) {
      onSetSettingsError(
        "GhostWriter must stay visible in either the tray or the dock.",
      );
      return;
    }
    onUpdateSettings({ showInTray: nextTray });
  }

  async function toggleDockVisibility() {
    const currentTray = settings?.showInTray ?? true;
    const currentDock = settings?.showInDock ?? true;
    const nextDock = !currentDock;
    if (!nextDock && !currentTray) {
      onSetSettingsError(
        "GhostWriter must stay visible in either the tray or the dock.",
      );
      return;
    }
    onUpdateSettings({ showInDock: nextDock });
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      <ToggleRow
        label="Show in tray"
        description="Keep GhostWriter available from the macOS menu bar."
        value={settings?.showInTray ?? true}
        onToggle={toggleTrayVisibility}
      />
      <ToggleRow
        label="Show in dock"
        description="Display GhostWriter as a normal app icon in the dock."
        value={settings?.showInDock ?? true}
        onToggle={toggleDockVisibility}
      />
      <ToggleRow
        label="Open on macOS boot"
        description="Automatically start GhostWriter when you log in."
        value={settings?.openAtLogin ?? false}
        onToggle={() =>
          onUpdateSettings({
            openAtLogin: !(settings?.openAtLogin ?? false),
          })
        }
      />
      <ToggleRow
        label="Sound effects"
        description="Play a short sound when ghosting starts and stops."
        value={settings?.soundEffectsEnabled ?? true}
        onToggle={() =>
          onUpdateSettings({
            soundEffectsEnabled: !(settings?.soundEffectsEnabled ?? true),
          })
        }
      />
      {displays.length > 1 && (
        <div className="py-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">Overlay display</span>
            <select
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 hover:cursor-pointer"
              value={settings?.overlayDisplayId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onUpdateSettings({
                  overlayDisplayId: value === "" ? null : Number(value),
                });
              }}
            >
              <option value="">Primary display</option>
              {displays.map((display) => (
                <option key={display.id} value={display.id}>
                  {display.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Choose which screen the overlay appears on.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
