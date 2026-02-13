"use client";

import { AuthShell } from "@/app/components/auth-shell";
import { useState } from "react";

export function SignUpView({
  email,
  onSignUp,
  onBack,
}: {
  email: string;
  onSignUp: (email: string, password: string, name: string) => Promise<unknown>;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await onSignUp(email, password, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="This will take just a minute."
      currentStep="signin"
    >
      <div className="flex flex-col gap-4">
        {/* Email form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Enter your full name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
              required
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              type="email"
              value={email}
              disabled
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-muted cursor-not-allowed"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Create a password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a secure password"
              required
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-ember/10 px-3 py-2 text-xs text-ember">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-ink hover:underline"
        >
          Try a different email or login method
        </button>

        <p className="mt-2 text-center text-xs text-ink/80 w-80 mx-auto">
          By signing up, you agree to our{" "}
          <button type="button" className="font-semibold text-ink">
            Terms of Service
          </button>{" "}
          and{" "}
          <button type="button" className="font-semibold text-ink">
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </AuthShell>
  );
}
