"use client";

import { formatShortcut } from "@/lib/ghost-helpers";
import { cn } from "@/lib/utils";
import type { GhostingState, GhostwriterSettings } from "@/types/ghostwriter";
import { useCallback, useEffect, useState } from "react";

type TestPhase = "idle" | "recording" | "transcribing" | "cleaning" | "done";

export function OnboardingShortcuts() {
  const [settings, setSettings] = useState<GhostwriterSettings | null>(null);
  const [apiReady, setApiReady] = useState(false);

  // Shortcut capture state
  const [shortcutCapture, setShortcutCapture] = useState(false);
  const [capturePreview, setCapturePreview] = useState("Press new shortcut…");
  const [toggleShortcutCapture, setToggleShortcutCapture] = useState(false);
  const [toggleCapturePreview, setToggleCapturePreview] = useState(
    "Press new shortcut…",
  );

  // Test ghosting state
  const [testPhase, setTestPhase] = useState<TestPhase>("idle");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [hasTestedSuccessfully, setHasTestedSuccessfully] = useState(false);

  useEffect(() => {
    if (!window.ghostwriter) {
      setApiReady(false);
      return;
    }
    setApiReady(true);

    window.ghostwriter
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);

    const unsubSettings = window.ghostwriter.onSettings((next) => {
      setSettings(next);
      setShortcutCapture(false);
      setCapturePreview("Press new shortcut…");
      setToggleShortcutCapture(false);
      setToggleCapturePreview("Press new shortcut…");
    });

    const unsubPreview = window.ghostwriter.onShortcutPreview((preview) => {
      setCapturePreview(preview);
      setToggleCapturePreview(preview);
    });

    const unsubState = window.ghostwriter.onGhostingState((state) => {
      handleGhostingState(state);
    });

    return () => {
      unsubSettings();
      unsubPreview();
      unsubState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGhostingState = useCallback((state: GhostingState) => {
    const phase = state.phase;
    if (phase === "recording") {
      setTestPhase("recording");
      setTestResult(null);
    } else if (phase === "transcribing") {
      setTestPhase("transcribing");
    } else if (phase === "cleaning") {
      setTestPhase("cleaning");
    } else if (phase === "idle") {
      // Ghosting just finished — check if there's a result
      if (state.lastGhostedText || state.lastRawText) {
        setTestPhase("done");
        setTestResult(state.lastGhostedText || state.lastRawText);
        setHasTestedSuccessfully(true);
      } else {
        setTestPhase("idle");
      }
    } else if (phase === "error") {
      setTestPhase("idle");
      setTestResult("Something went wrong. Try again!");
    }
  }, []);

  // ── Shortcut capture ──

  async function beginShortcutCapture() {
    if (!window.ghostwriter) return;
    try {
      await window.ghostwriter.startShortcutCapture("shortcut");
      setShortcutCapture(true);
      setCapturePreview("Press new shortcut…");
    } catch {
      // ignore
    }
  }

  async function endShortcutCapture() {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopShortcutCapture();
    setShortcutCapture(false);
    setCapturePreview("Press new shortcut…");
  }

  async function beginToggleShortcutCapture() {
    if (!window.ghostwriter) return;
    try {
      await window.ghostwriter.startShortcutCapture("toggleShortcut");
      setToggleShortcutCapture(true);
      setToggleCapturePreview("Press new shortcut…");
    } catch {
      // ignore
    }
  }

  async function endToggleShortcutCapture() {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopShortcutCapture();
    setToggleShortcutCapture(false);
    setToggleCapturePreview("Press new shortcut…");
  }

  async function clearToggleShortcut() {
    if (!window.ghostwriter) return;
    try {
      const next = await window.ghostwriter.updateSettings({
        toggleShortcut: null,
      });
      setSettings(next);
    } catch {
      // ignore
    }
  }

  const phaseLabel: Record<TestPhase, string> = {
    idle: "Ready to test",
    recording: "Listening…",
    transcribing: "Transcribing…",
    cleaning: "Cleaning up…",
    done: "Done!",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <h1 className="text-center font-serif text-2xl font-semibold text-ink">
          Set up your shortcuts
        </h1>
        <p className="text-center text-sm text-muted">
          Choose how you want to trigger ghosting, then try it out.
        </p>
      </div>

      {/* Ghosting shortcut (hold) */}
      <div className="mb-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Hold-to-ghost shortcut</span>
          <span className="text-xs text-muted">
            Hold down to start ghosting, release to stop.
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="ghostwriter-code flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              style={
                shortcutCapture
                  ? {
                      borderColor: "#6944AE",
                      backgroundColor: "rgba(105, 68, 174, 0.1)",
                    }
                  : {}
              }
              value={
                shortcutCapture
                  ? capturePreview
                  : settings?.shortcut
                    ? formatShortcut(settings.shortcut)
                    : "Not set"
              }
              placeholder="Press shortcut"
              readOnly
              onFocus={beginShortcutCapture}
              onBlur={endShortcutCapture}
              onMouseDown={(e) => {
                if (shortcutCapture) return;
                e.preventDefault();
                beginShortcutCapture();
              }}
            />
            {settings?.shortcut && !shortcutCapture && (
              <button
                type="button"
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted transition hover:cursor-pointer hover:bg-border/50 hover:text-ink"
                onClick={async () => {
                  if (!window.ghostwriter) return;
                  try {
                    const next = await window.ghostwriter.updateSettings({
                      shortcut: null,
                    });
                    setSettings(next);
                  } catch {
                    // ignore
                  }
                }}
              >
                Clear
              </button>
            )}
          </div>
        </label>
      </div>

      {/* Toggle shortcut */}
      <div className="mb-6">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">
            Toggle-to-ghost shortcut{" "}
            <span className="font-normal text-muted">(optional)</span>
          </span>
          <span className="text-xs text-muted">
            Press once to start ghosting, press again to stop — hands-free.
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="ghostwriter-code flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              style={
                toggleShortcutCapture
                  ? {
                      borderColor: "#6944AE",
                      backgroundColor: "rgba(105, 68, 174, 0.1)",
                    }
                  : {}
              }
              value={
                toggleShortcutCapture
                  ? toggleCapturePreview
                  : settings?.toggleShortcut
                    ? formatShortcut(settings.toggleShortcut)
                    : "Not set"
              }
              placeholder="Press shortcut"
              readOnly
              onFocus={beginToggleShortcutCapture}
              onBlur={endToggleShortcutCapture}
              onMouseDown={(e) => {
                if (toggleShortcutCapture) return;
                e.preventDefault();
                beginToggleShortcutCapture();
              }}
            />
            {settings?.toggleShortcut && !toggleShortcutCapture && (
              <button
                type="button"
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted transition hover:cursor-pointer hover:bg-border/50 hover:text-ink"
                onClick={clearToggleShortcut}
              >
                Clear
              </button>
            )}
          </div>
        </label>
      </div>

      {/* Divider */}
      <div className="mb-6 border-t border-border" />

      {/* Try it out */}
      <div className="mb-6">
        <h2 className="mb-1 text-sm font-medium text-ink">Try it out</h2>
        <p className="mb-4 text-xs text-muted">
          {settings?.shortcut
            ? `Hold ${formatShortcut(settings.shortcut)} and say something${settings?.toggleShortcut ? `, or press ${formatShortcut(settings.toggleShortcut)} to toggle` : ""}.`
            : "Use your shortcut and say something to test ghosting."}
        </p>

        {/* Status indicator */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border-2 px-5 py-4 transition-all",
            testPhase === "idle" && "border-border bg-sidebar",
            testPhase === "recording" && "border-accent/50 bg-accent/5",
            testPhase === "transcribing" && "border-amber-300/50 bg-amber-50",
            testPhase === "cleaning" && "border-amber-300/50 bg-amber-50",
            testPhase === "done" && "border-emerald-400/50 bg-emerald-50",
          )}
        >
          {/* Pulsing dot */}
          <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
            {(testPhase === "recording" ||
              testPhase === "transcribing" ||
              testPhase === "cleaning") && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-50",
                  testPhase === "recording" ? "bg-accent" : "bg-amber-400",
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full",
                testPhase === "idle" && "bg-muted/40",
                testPhase === "recording" && "bg-accent",
                (testPhase === "transcribing" || testPhase === "cleaning") &&
                  "bg-amber-400",
                testPhase === "done" && "bg-emerald-500",
              )}
            />
          </div>

          <div className="flex flex-col">
            <span
              className={cn(
                "text-sm font-medium",
                testPhase === "idle" && "text-muted",
                testPhase === "recording" && "text-accent",
                (testPhase === "transcribing" || testPhase === "cleaning") &&
                  "text-amber-600",
                testPhase === "done" && "text-emerald-700",
              )}
            >
              {phaseLabel[testPhase]}
            </span>
            {testPhase === "done" && testResult && (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                &ldquo;{testResult}&rdquo;
              </p>
            )}
            {testPhase === "idle" && testResult && !hasTestedSuccessfully && (
              <p className="mt-0.5 text-xs text-ember">{testResult}</p>
            )}
          </div>
        </div>

        {hasTestedSuccessfully && (
          <p className="mt-3 text-center text-xs font-medium text-emerald-600">
            ✓ Ghosting is working!
          </p>
        )}
      </div>

      <p className="text-center text-xs text-muted">
        You can change shortcuts anytime in Settings.
      </p>
    </div>
  );
}
