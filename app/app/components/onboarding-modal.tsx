"use client";

import { cn } from "@/lib/utils";
import type { DisplayInfo, StylePreferences } from "@/types/ghostwriter";
import { useEffect, useState } from "react";
import { Modal } from "./modal";
import { OnboardingConsent } from "./onboarding-consent";
import { OnboardingDisplay } from "./onboarding-display";
import { OnboardingShortcuts } from "./onboarding-shortcuts";
import { OnboardingStyle } from "./onboarding-style";

type Step = "welcome" | "consent" | "style" | "shortcuts" | "display";

const STEPS_BASE: Step[] = ["welcome", "consent", "style", "shortcuts"];
const STEPS_WITH_DISPLAY: Step[] = [
  "welcome",
  "consent",
  "style",
  "shortcuts",
  "display",
];

export function OnboardingModal({
  open,
  onComplete,
}: {
  open: boolean;
  onComplete: (
    shareTranscripts: boolean,
    stylePreferences: StylePreferences,
    overlayDisplayId: number | null,
  ) => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [shareTranscripts, setShareTranscripts] = useState(false);
  const [stylePreferences, setStylePreferences] =
    useState<StylePreferences | null>(null);
  const [overlayDisplayId, setOverlayDisplayId] = useState<number | null>(null);
  const [hasMultipleDisplays, setHasMultipleDisplays] = useState(false);

  const steps = hasMultipleDisplays ? STEPS_WITH_DISPLAY : STEPS_BASE;
  const currentIndex = steps.indexOf(step);
  const totalSteps = steps.length;

  // Check display count once on mount so we know whether to show the step
  useEffect(() => {
    window.ghostwriter
      ?.getDisplays()
      .then((d: DisplayInfo[]) => setHasMultipleDisplays(d.length > 1))
      .catch(() => undefined);
  }, []);

  function goNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  }

  function goBack() {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  }

  function handleFinish() {
    const defaults: StylePreferences = {
      personal: "casual",
      work: "casual",
      email: "casual",
      code: "casual",
      other: "casual",
    };
    onComplete(
      shareTranscripts,
      stylePreferences ?? defaults,
      overlayDisplayId,
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {}}
      showCloseButton={false}
      size="custom"
      panelClassName="max-w-[680px]"
      zIndex={60}
    >
      <div className="px-8 pt-8 pb-6">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-0.75 rounded-full transition-all duration-300",
                i <= currentIndex ? "w-12 bg-ink" : "w-8 bg-border",
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-95">
          {step === "welcome" && <WelcomeStep />}

          {step === "consent" && (
            <OnboardingConsent
              shareTranscripts={shareTranscripts}
              onChoice={(share) => setShareTranscripts(share)}
            />
          )}

          {step === "style" && (
            <OnboardingStyle
              stylePreferences={stylePreferences}
              onChoice={(prefs) => setStylePreferences(prefs)}
            />
          )}

          {step === "shortcuts" && <OnboardingShortcuts />}

          {step === "display" && (
            <OnboardingDisplay
              onChoice={(displayId) => setOverlayDisplayId(displayId)}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <div>
            {currentIndex > 0 && (
              <button
                type="button"
                className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-ink transition hover:bg-sidebar hover:cursor-pointer"
                onClick={goBack}
              >
                Back
              </button>
            )}
          </div>

          <div>
            {step === "welcome" && (
              <button
                type="button"
                className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 hover:cursor-pointer"
                onClick={goNext}
              >
                Start personalization
              </button>
            )}

            {(step === "consent" || step === "style") && (
              <button
                type="button"
                className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 hover:cursor-pointer"
                onClick={goNext}
              >
                Next
              </button>
            )}

            {step === "shortcuts" && (
              <button
                type="button"
                className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 hover:cursor-pointer"
                onClick={() => {
                  if (hasMultipleDisplays) {
                    goNext();
                  } else {
                    handleFinish();
                  }
                }}
              >
                Next
              </button>
            )}

            {step === "display" && (
              <button
                type="button"
                className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 hover:cursor-pointer"
                onClick={handleFinish}
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ── Welcome step ── */

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="assets/ghosty.png" alt="Ghosty" className="mb-6 h-16 w-16" />

      <h1 className="mb-3 text-center font-serif text-3xl font-semibold text-ink">
        Let&apos;s personalize GhostWriter to you
      </h1>

      <p className="mb-10 max-w-sm text-center text-sm leading-relaxed text-muted">
        Set how GhostWriter writes when you dictate - your privacy settings,
        writing style, shortcuts, and more.
      </p>

      {/* Feature preview icons */}
      <div className="flex items-center gap-6 text-muted">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="text-xs">Privacy</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <span className="text-xs">Style</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 14l9-5-9-5-9 5 9 5zm0 7l-9-5 9 5 9-5-9 5zm0-7l9-5-9 5-9-5 9 5z" />
            </svg>
          </div>
          <span className="text-xs">Shortcuts</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xs">Display</span>
        </div>
      </div>
    </div>
  );
}
