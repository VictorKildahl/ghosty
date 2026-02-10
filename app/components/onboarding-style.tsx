"use client";

import { cn } from "@/lib/utils";
import type { WritingStyle } from "@/types/ghosttype";
import { useState } from "react";

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
  onChoice,
}: {
  onChoice: (writingStyle: WritingStyle) => void;
}) {
  const [selectedStyle, setSelectedStyle] = useState<WritingStyle>("casual");

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-sidebar">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-white p-8 shadow-soft">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="assets/ghosty.png" alt="Ghosty" className="h-14 w-14" />
          <h1 className="text-xl font-semibold text-ink">
            How do you like to write?
          </h1>
          <p className="text-sm text-muted">
            Choose a style for your cleaned-up transcriptions.
          </p>
        </div>

        {/* Style cards */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          {WRITING_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => setSelectedStyle(style.id)}
                className={cn(
                  "flex flex-col items-start rounded-xl border-2 p-5 text-left transition",
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

        <button
          type="button"
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90"
          onClick={() => onChoice(selectedStyle)}
        >
          Continue
        </button>

        <p className="mt-4 text-center text-xs text-muted">
          You can change this later in Settings.
        </p>
      </div>
    </div>
  );
}
