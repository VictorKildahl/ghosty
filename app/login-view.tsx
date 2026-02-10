"use client";

import { useState } from "react";

export function LoginView({
  onLogin,
  onSwitchToSignUp,
}: {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onSwitchToSignUp: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-sidebar">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-soft">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="assets/ghosty.png" alt="Ghosty" className="h-12 w-12" />
          <h1 className="text-xl font-semibold text-ink">Welcome back</h1>
          <p className="text-sm text-muted">
            Sign in to your GhostWriter account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
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
            className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Don&apos;t have an account?{" "}
          <button
            onClick={onSwitchToSignUp}
            className="font-medium text-accent hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
