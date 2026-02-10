"use client";

import { OnboardingConsent } from "@/app/components/onboarding-consent";
import { OnboardingDisplay } from "@/app/components/onboarding-display";
import { OnboardingStyle } from "@/app/components/onboarding-style";
import type { DisplayInfo, StylePreferences } from "@/types/ghosttype";
import { useEffect, useState } from "react";

type Step = "consent" | "style" | "display";

export function OnboardingView({
  onComplete,
}: {
  onComplete: (
    shareTranscripts: boolean,
    stylePreferences: StylePreferences,
    overlayDisplayId: number | null,
  ) => void;
}) {
  const [step, setStep] = useState<Step>("consent");
  const [shareTranscripts, setShareTranscripts] = useState(false);
  const [stylePreferences, setStylePreferences] =
    useState<StylePreferences | null>(null);
  const [hasMultipleDisplays, setHasMultipleDisplays] = useState(false);

  // Check display count once on mount so we know whether to show the step
  useEffect(() => {
    window.ghosttype
      ?.getDisplays()
      .then((d: DisplayInfo[]) => setHasMultipleDisplays(d.length > 1))
      .catch(() => undefined);
  }, []);

  if (step === "consent") {
    return (
      <OnboardingConsent
        onChoice={(share) => {
          setShareTranscripts(share);
          setStep("style");
        }}
      />
    );
  }

  if (step === "style") {
    return (
      <OnboardingStyle
        onChoice={(prefs) => {
          if (hasMultipleDisplays) {
            setStylePreferences(prefs);
            setStep("display");
          } else {
            onComplete(shareTranscripts, prefs, null);
          }
        }}
      />
    );
  }

  return (
    <OnboardingDisplay
      onChoice={(displayId) =>
        onComplete(shareTranscripts, stylePreferences!, displayId)
      }
    />
  );
}
