"use client";

import { AuthShell } from "@/app/components/auth-shell";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function VerifyEmailView({
  email,
  userId,
  onBack,
}: {
  email: string;
  userId: Id<"users">;
  onBack: () => void;
}) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const resendVerification = useAction(
    api.emailVerification.resendVerificationEmail,
  );

  async function handleResend() {
    setResending(true);
    setResent(false);
    try {
      await resendVerification({ userId });
      setResent(true);
    } catch {
      // Silently fail — user can retry
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle="You need to verify your account"
      currentStep="signin"
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink">
          We sent an email to &ldquo;<strong>{email}</strong>&rdquo;
        </p>

        <ol className="list-decimal pl-5 text-sm text-ink space-y-2">
          <li>
            Click <strong>&ldquo;Verify account&rdquo;</strong> to finish
            signing up. You can do this from any device.
          </li>
          <li>
            Come back here when you&rsquo;re done. This page will auto-reload.
          </li>
        </ol>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-sidebar disabled:opacity-50"
          >
            {resending
              ? "Sending…"
              : resent
                ? "Verification email sent!"
                : "Resend verification email"}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-sidebar"
          >
            Try a different email or login method
          </button>
        </div>

        <p className="text-xs text-muted">
          Make sure you check your Spam / Trash for an email from{" "}
          <strong>onboarding@resend.dev</strong>
        </p>
      </div>
    </AuthShell>
  );
}
