"use client";

import { cn } from "@/lib/utils";
import type {
  AppCategory,
  GhosttypeSettings,
  WritingStyle,
} from "@/types/ghosttype";
import { useEffect, useState } from "react";
import { PageLayout } from "./page-layout";

/* ── Tab definitions ────────────────────────────────────────────────── */

type TabDef = {
  id: AppCategory;
  label: string;
  description: string;
  styles: StyleOption[];
};

type StyleOption = {
  id: WritingStyle;
  label: string;
  description: string;
  example: string;
};

const MESSAGING_STYLES: StyleOption[] = [
  {
    id: "formal",
    label: "Formal.",
    description: "Caps + Punctuation",
    example:
      "Hey, are you free for lunch tomorrow? Let's do 12 if that works for you.",
  },
  {
    id: "casual",
    label: "Casual",
    description: "Caps + Less punctuation",
    example:
      "Hey are you free for lunch tomorrow? Let's do 12 if that works for you",
  },
  {
    id: "very-casual",
    label: "very casual",
    description: "No Caps + Less punctuation",
    example:
      "hey are you free for lunch tomorrow? let's do 12 if that works for you",
  },
];

const EMAIL_OTHER_STYLES: StyleOption[] = [
  {
    id: "formal",
    label: "Formal.",
    description: "Caps + Punctuation",
    example:
      "So far, I am enjoying the new workout routine. I am excited for tomorrow's workout, especially after a full night of rest.",
  },
  {
    id: "casual",
    label: "Casual",
    description: "Caps + Less punctuation",
    example:
      "So far I am enjoying the new workout routine. I am excited for tomorrow's workout especially after a full night of rest.",
  },
  {
    id: "excited",
    label: "Excited!",
    description: "More exclamations",
    example:
      "So far I am enjoying the new workout routine. I am excited for tomorrow's workout, especially after a full night of rest!",
  },
];

const TABS: TabDef[] = [
  {
    id: "personal",
    label: "Personal messages",
    description: "iMessage, WhatsApp, Telegram, Messenger …",
    styles: MESSAGING_STYLES,
  },
  {
    id: "work",
    label: "Work messages",
    description: "Slack, Teams, Zoom, Linear …",
    styles: MESSAGING_STYLES,
  },
  {
    id: "email",
    label: "Email",
    description: "Mail, Outlook, Spark, Superhuman …",
    styles: EMAIL_OTHER_STYLES,
  },
  {
    id: "code",
    label: "Code",
    description: "VS Code, Cursor, Zed, terminals, JetBrains IDEs …",
    styles: EMAIL_OTHER_STYLES,
  },
  {
    id: "other",
    label: "Other",
    description: "Notes, Docs, ChatGPT, and all other apps",
    styles: EMAIL_OTHER_STYLES,
  },
];

/* ── Component ──────────────────────────────────────────────────────── */

export function StyleView() {
  const [settings, setSettings] = useState<GhosttypeSettings | null>(null);
  const [activeTab, setActiveTab] = useState<AppCategory>("personal");

  useEffect(() => {
    if (!window.ghosttype) return;
    window.ghosttype
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);

    const unsub = window.ghosttype.onSettings(setSettings);
    return unsub;
  }, []);

  async function selectStyle(category: AppCategory, style: WritingStyle) {
    if (!window.ghosttype) return;
    try {
      const next = await window.ghosttype.updateSettings({
        stylePreferences: { [category]: style },
      });
      setSettings(next);
    } catch {
      // ignore
    }
  }

  const tab = TABS.find((t) => t.id === activeTab)!;
  const currentStyle = settings?.stylePreferences[activeTab] ?? "casual";

  return (
    <PageLayout
      title="Style"
      subtitle="Choose how your cleaned-up text sounds per type of app."
    >
      <div>
        {/* Tabs */}
        <div className="mb-2 flex gap-6 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "relative pb-2.5 text-sm font-medium transition hover:cursor-pointer",
                activeTab === t.id
                  ? "text-ink"
                  : "text-muted hover:text-ink/70",
              )}
            >
              {t.label}
              {activeTab === t.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink" />
              )}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className="mb-6 text-xs text-muted">{tab.description}</p>

        {/* Style cards */}
        <div className="grid grid-cols-3 gap-4">
          {tab.styles.map((style) => {
            const isSelected = currentStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => selectStyle(activeTab, style.id)}
                className={cn(
                  "flex flex-col items-start rounded-xl border-2 p-5 text-left transition hover:cursor-pointer",
                  isSelected
                    ? "border-accent bg-accent/5"
                    : "border-border bg-white hover:border-accent/40",
                )}
              >
                <span
                  className={cn(
                    "text-2xl font-semibold",
                    style.id === "very-casual" ? "lowercase" : "",
                    isSelected ? "text-accent" : "text-ink",
                  )}
                >
                  {style.label}
                </span>
                <span className="mt-1 text-xs font-medium text-muted">
                  {style.description}
                </span>
                <p className="mt-4 rounded-lg bg-sidebar p-3 text-xs leading-relaxed text-muted">
                  {style.example}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
}
