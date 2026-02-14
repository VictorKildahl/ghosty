"use client";

import { cn } from "@/lib/utils";
import type { StylePreferences, WritingStyle } from "@/types/ghostwriter";
import { useEffect, useState } from "react";

const WRITING_STYLES: {
  id: WritingStyle;
  label: string;
  description: string;
  example: string;
}[] = [
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

export function OnboardingStyle({
  stylePreferences,
  onChoice,
}: {
  stylePreferences: StylePreferences | null;
  onChoice: (stylePreferences: StylePreferences) => void;
}) {
  const [selectedStyle, setSelectedStyle] = useState<WritingStyle>(
    stylePreferences?.personal ?? "casual",
  );

  // Fire the default choice on mount so parent always has a value
  useEffect(() => {
    if (!stylePreferences) {
      onChoice({
        personal: selectedStyle,
        work: selectedStyle,
        email: selectedStyle,
        code: selectedStyle,
        other: selectedStyle,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire the choice whenever selection changes so the parent always has the latest
  function handleSelect(style: WritingStyle) {
    setSelectedStyle(style);
    onChoice({
      personal: style,
      work: style,
      email: style,
      code: style,
      other: style,
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <h1 className="text-center font-serif text-2xl font-semibold text-ink">
          How do you like to write?
        </h1>
        <p className="text-center text-sm text-muted">
          Choose a default style for your cleaned-up transcriptions.
        </p>
      </div>

      {/* Style cards */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        {WRITING_STYLES.map((style) => {
          const isSelected = selectedStyle === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => handleSelect(style.id)}
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

      <p className="text-center text-xs text-muted">
        You can change this later in Settings.
      </p>
    </div>
  );
}
