"use client";

import { cn } from "@/lib/utils";
import type { DisplayInfo } from "@/types/ghosttype";
import { Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function OnboardingDisplay({
  onChoice,
}: {
  onChoice: (displayId: number | null) => void;
}) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    window.ghosttype
      ?.getDisplays()
      .then((d) => {
        setDisplays(d);
        // Default to primary
        const primary = d.find((x) => x.isPrimary);
        if (primary) setSelectedId(primary.id);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-sidebar">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-soft">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="assets/ghosty.png" alt="Ghosty" className="h-12 w-12" />
          <h1 className="text-xl font-semibold text-ink">
            Where should the overlay live?
          </h1>
          <p className="text-sm text-muted">
            Choose which display the ghosting overlay appears on.
          </p>
        </div>

        {/* Display cards */}
        <div className="mb-6 flex flex-col gap-3">
          {displays.map((d) => {
            const isSelected = selectedId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition hover:cursor-pointer",
                  isSelected
                    ? "border-accent bg-accent/5"
                    : "border-border bg-white hover:border-accent/40",
                )}
              >
                <Monitor
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isSelected ? "text-accent" : "text-muted",
                  )}
                />
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-accent" : "text-ink",
                    )}
                  >
                    {d.label}
                  </span>
                  <span className="text-xs text-muted">
                    {d.width} × {d.height}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90"
          onClick={() => onChoice(selectedId)}
        >
          Continue
        </button>

        <p className="mt-6 text-center text-xs text-muted">
          You can change this later in Settings.
        </p>
      </div>
    </div>
  );
}
