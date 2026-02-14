"use client";

import { cn } from "@/lib/utils";

export function OnboardingConsent({
  shareTranscripts,
  onChoice,
}: {
  shareTranscripts: boolean;
  onChoice: (shareTranscripts: boolean) => void;
}) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <h1 className="text-center font-serif text-2xl font-semibold text-ink">
          Help improve GhostWriter?
        </h1>
        <p className="max-w-md text-center text-sm text-muted">
          Choose whether to share your transcriptions to help us improve.
        </p>
      </div>

      <div className="mx-auto max-w-md">
        <p className="mb-2 text-sm leading-relaxed text-muted">
          We&apos;d love to use your transcriptions to make GhostWriter more
          accurate over time. If you opt in, your raw and cleaned-up
          transcriptions will be stored securely in the cloud.
        </p>

        <p className="mb-6 text-sm leading-relaxed text-muted">
          Your transcriptions are always saved locally on your Mac regardless of
          this choice. You can change this at any time in{" "}
          <span className="font-medium text-ink">Settings</span>.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={cn(
              "rounded-xl border-2 px-5 py-4 text-left text-sm font-medium transition hover:cursor-pointer",
              shareTranscripts
                ? "border-accent bg-accent/5 text-accent"
                : "border-border text-ink hover:border-accent/40",
            )}
            onClick={() => onChoice(true)}
          >
            <span className="block text-base font-semibold">
              Yes, share my transcriptions
            </span>
            <span className="mt-1 block text-xs font-normal text-muted">
              Help improve speech recognition quality for everyone.
            </span>
          </button>
          <button
            type="button"
            className={cn(
              "rounded-xl border-2 px-5 py-4 text-left text-sm font-medium transition hover:cursor-pointer",
              !shareTranscripts
                ? "border-accent bg-accent/5 text-accent"
                : "border-border text-ink hover:border-accent/40",
            )}
            onClick={() => onChoice(false)}
          >
            <span className="block text-base font-semibold">No thanks</span>
            <span className="mt-1 block text-xs font-normal text-muted">
              Keep everything local on your Mac only.
            </span>
          </button>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted/70">
          We never share your data with third parties. Transcriptions are only
          used to improve speech recognition quality.
        </p>
      </div>
    </div>
  );
}
