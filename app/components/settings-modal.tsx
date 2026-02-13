"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import type {
  GhostwriterSettings,
  GhostwriterSettingsUpdate,
} from "@/types/ghostwriter";
import {
  CreditCard,
  Mic,
  MonitorCog,
  Shield,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { Modal } from "./modal";
import { SettingsAccountView } from "./settings-account-view";
import { SettingsBillingView } from "./settings-billing-view";
import { SettingsGeneralView } from "./settings-general-view";
import { SettingsPrivacyView } from "./settings-privacy-view";
import { SettingsSystemView } from "./settings-system-view";
import { SettingsVoiceView } from "./settings-voice-view";

const BILLING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BILLING === "true";

export type SettingsSection =
  | "general"
  | "voice"
  | "system"
  | "account"
  | "billing"
  | "privacy";

type SettingsModalProps = {
  isAdmin: boolean;
  userId: Id<"users">;
  initialSection?: SettingsSection;
  onClose: () => void;
  onAccountDeleted: () => void;
  onSignOut: () => void;
};

const SECTION_LABELS: Record<SettingsSection, string> = {
  general: "General",
  voice: "Voice",
  system: "System",
  account: "Account",
  billing: "Plans & Billing",
  privacy: "Data & Privacy",
};

const SECTION_SUBTITLES: Record<SettingsSection, string> = {
  general: "Keybinds, behavior, and AI cleanup.",
  voice: "Language selection and microphone.",
  system: "App presence, overlay, and sound.",
  account: "Profile and account management.",
  billing: "Manage your plan and billing cycle.",
  privacy: "Privacy controls and bug reports.",
};

export function SettingsModal({
  isAdmin,
  userId,
  initialSection = "general",
  onClose,
  onAccountDeleted,
  onSignOut,
}: SettingsModalProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(initialSection);
  const [settings, setSettings] = useState<GhostwriterSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.ghostwriter) return;

    window.ghostwriter
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);

    const unsubscribeSettings = window.ghostwriter.onSettings((next) => {
      setSettings(next);
    });

    return () => {
      unsubscribeSettings();
    };
  }, []);

  async function updateSettings(patch: GhostwriterSettingsUpdate) {
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

  function renderSectionContent() {
    switch (activeSection) {
      case "general":
        return (
          <SettingsGeneralView
            settings={settings}
            isAdmin={isAdmin}
            onUpdateSettings={updateSettings}
          />
        );
      case "voice":
        return (
          <SettingsVoiceView
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        );
      case "system":
        return (
          <SettingsSystemView
            settings={settings}
            settingsError={settingsError}
            onSetSettingsError={setSettingsError}
            onUpdateSettings={updateSettings}
          />
        );
      case "account":
        return (
          <SettingsAccountView
            userId={userId}
            onAccountDeleted={onAccountDeleted}
            onSignOut={onSignOut}
          />
        );
      case "billing":
        return BILLING_ENABLED ? <SettingsBillingView userId={userId} /> : null;
      case "privacy":
        return (
          <SettingsPrivacyView
            settings={settings}
            userId={userId}
            onUpdateSettings={updateSettings}
          />
        );
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="custom"
      showCloseButton={false}
      panelClassName="flex h-[84vh] w-[min(1150px,96vw)] overflow-hidden rounded-3xl border border-border shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      zIndex={120}
    >
      <div className="flex h-full flex-col bg-sidebar">
        {/* Header – full width, just close button, like main app Header */}
        <header className="flex h-12 shrink-0 items-center justify-end px-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition hover:bg-white hover:text-ink hover:cursor-pointer"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body – sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar – mirrors main app sidebar */}
          <aside className="flex w-54 shrink-0 flex-col">
            <div className="flex flex-1 flex-col gap-1 px-3">
              <p className="mb-3 px-3 text-xs font-semibold tracking-[0.14em] text-muted">
                SETTINGS
              </p>

              <SidebarSectionButton
                icon={SlidersHorizontal}
                label="General"
                active={activeSection === "general"}
                onClick={() => setActiveSection("general")}
              />
              <SidebarSectionButton
                icon={Mic}
                label="Voice"
                active={activeSection === "voice"}
                onClick={() => setActiveSection("voice")}
              />
              <SidebarSectionButton
                icon={MonitorCog}
                label="System"
                active={activeSection === "system"}
                onClick={() => setActiveSection("system")}
              />

              <div className="my-3 border-t border-border" />

              <p className="mb-3 px-3 text-xs font-semibold tracking-[0.14em] text-muted">
                ACCOUNT
              </p>

              <SidebarSectionButton
                icon={UserRound}
                label="Account"
                active={activeSection === "account"}
                onClick={() => setActiveSection("account")}
              />
              {BILLING_ENABLED && (
                <SidebarSectionButton
                  icon={CreditCard}
                  label="Plans & Billing"
                  active={activeSection === "billing"}
                  onClick={() => setActiveSection("billing")}
                />
              )}
              <SidebarSectionButton
                icon={Shield}
                label="Data & Privacy"
                active={activeSection === "privacy"}
                onClick={() => setActiveSection("privacy")}
              />
            </div>
          </aside>

          {/* Content – rounded-tl-xl bg-white like main app */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-tl-xl bg-white">
            {/* Page header – matches PageLayout */}
            <header className="shrink-0 px-8 pt-8 pb-6">
              <div className="mx-auto w-full max-w-3xl">
                <h2 className="text-2xl font-semibold text-ink">
                  {SECTION_LABELS[activeSection]}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {SECTION_SUBTITLES[activeSection]}
                </p>
              </div>
            </header>

            {/* Scrollable content – matches PageLayout */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2">
              <div className="mx-auto w-full max-w-3xl">
                {renderSectionContent()}
              </div>

              {settingsError && (
                <p className="mt-4 text-xs text-ember">{settingsError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SidebarSectionButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-start gap-2.5 overflow-hidden rounded-lg px-3 py-2 text-left text-sm font-medium transition-all hover:cursor-pointer",
        active
          ? "bg-white text-ink shadow-xs"
          : "text-ink hover:bg-white hover:text-ink",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
