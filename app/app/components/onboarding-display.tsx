"use client";

import { cn } from "@/lib/utils";
import type { DisplayInfo } from "@/types/ghostwriter";
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
    window.ghostwriter
      ?.getDisplays()
      .then((d) => {
        setDisplays(d);
        // Default to primary
        const primary = d.find((x) => x.isPrimary);
        if (primary) setSelectedId(primary.id);
      })
      .catch(() => undefined);
  }, []);

  // Notify parent whenever selection changes
  function handleSelect(id: number) {
    setSelectedId(id);
    onChoice(id);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <h1 className="text-center font-serif text-2xl font-semibold text-ink">
          Where should the overlay live?
        </h1>
        <p className="text-center text-sm text-muted">
          Choose which display the ghosting overlay appears on.
        </p>
      </div>

      {/* Display cards */}
      <div className="mx-auto mb-4 max-w-md flex flex-col gap-3">
        {displays.map((d) => {
          const isSelected = selectedId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => handleSelect(d.id)}
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

      <p className="text-center text-xs text-muted">
        You can change this later in Settings.
      </p>
    </div>
  );
}
