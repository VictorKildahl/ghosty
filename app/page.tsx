"use client";

import { HomeView } from "@/app/components/home-view";
import { OnboardingView } from "@/app/components/onboarding-view";
import { SettingsView } from "@/app/components/settings-view";
import { Sidebar, type View } from "@/app/components/sidebar";
import { StatsView } from "@/app/components/stats-view";
import { LoginView } from "@/app/login-view";
import { SignUpView } from "@/app/signup-view";
import { useAuth } from "@/app/use-auth";
import { useGhostStats } from "@/app/use-ghost-stats";
import type { WritingStyle } from "@/types/ghosttype";
import { useCallback, useState } from "react";

type AuthView = "login" | "signup";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [authView, setAuthView] = useState<AuthView>("login");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const {
    auth,
    loading: authLoading,
    isAuthenticated,
    signUp,
    login,
    logout,
  } = useAuth();

  const { stats, localTranscripts } = useGhostStats(auth?.userId ?? null);

  // Wrap signUp so we show consent prompt after a successful registration
  const handleSignUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const result = await signUp(email, password, name);
      setShowOnboarding(true);
      return result;
    },
    [signUp],
  );

  // Handle the onboarding completion (consent + style)
  const handleOnboardingComplete = useCallback(
    async (shareTranscripts: boolean, writingStyle: WritingStyle) => {
      try {
        await window.ghosttype?.updateSettings({
          shareTranscripts,
          writingStyle,
        });
      } catch {
        // Settings will remain at defaults if IPC fails
      }
      setShowOnboarding(false);
    },
    [],
  );

  // --------------- Loading ---------------
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  // --------------- Auth gate ---------------
  if (!isAuthenticated) {
    return authView === "login" ? (
      <LoginView
        onLogin={login}
        onSwitchToSignUp={() => setAuthView("signup")}
      />
    ) : (
      <SignUpView
        onSignUp={handleSignUp}
        onSwitchToLogin={() => setAuthView("login")}
      />
    );
  }

  // --------------- Onboarding (after signup) ---------------
  if (showOnboarding) {
    return <OnboardingView onComplete={handleOnboardingComplete} />;
  }

  // --------------- Authenticated app ---------------
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar
        currentView={view}
        onNavigate={setView}
        userEmail={auth?.email}
        onLogout={logout}
      />

      {view === "home" && (
        <HomeView stats={stats} localTranscripts={localTranscripts} />
      )}
      {view === "stats" && <StatsView stats={stats} />}
      {view === "settings" && <SettingsView />}
    </div>
  );
}
