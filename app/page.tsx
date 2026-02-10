"use client";

import { DictionaryView } from "@/app/components/dictionary-view";
import { Header } from "@/app/components/header";
import { HomeView } from "@/app/components/home-view";
import { OnboardingView } from "@/app/components/onboarding-view";
import { SettingsView } from "@/app/components/settings-view";
import { Sidebar, type View } from "@/app/components/sidebar";
import { SnippetsView } from "@/app/components/snippets-view";
import { StatsView } from "@/app/components/stats-view";
import { StyleView } from "@/app/components/style-view";
import { LoginView } from "@/app/login-view";
import { SignUpView } from "@/app/signup-view";
import { useAuth } from "@/app/use-auth";
import { useGhostStats } from "@/app/use-ghost-stats";
import { usePreferencesSync } from "@/app/use-preferences-sync";
import type { StylePreferences } from "@/types/ghosttype";
import { useCallback, useState } from "react";

type AuthView = "login" | "signup";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [authView, setAuthView] = useState<AuthView>("login");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    auth,
    loading: authLoading,
    isAuthenticated,
    signUp,
    login,
    logout,
  } = useAuth();

  const { stats, localTranscripts, deleteTranscript } = useGhostStats(
    auth?.userId ?? null,
  );

  // Keep Convex user record in sync with local preferences
  usePreferencesSync(auth?.userId ?? null);

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
    async (shareTranscripts: boolean, stylePreferences: StylePreferences) => {
      try {
        await window.ghosttype?.updateSettings({
          shareTranscripts,
          stylePreferences,
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
    <div className="flex h-screen w-screen overflow-hidden bg-sidebar">
      <Sidebar
        currentView={view}
        onNavigate={setView}
        collapsed={sidebarCollapsed}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={auth?.name}
          userEmail={auth?.email}
          onLogout={logout}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />

        <div className="flex flex-1 overflow-hidden rounded-tl-xl bg-white">
          {view === "home" && (
            <HomeView
              stats={stats}
              localTranscripts={localTranscripts}
              userName={auth?.name}
              onNavigateToStats={() => setView("stats")}
              onDeleteEntry={deleteTranscript}
            />
          )}
          {view === "stats" && <StatsView stats={stats} />}
          {view === "style" && <StyleView />}
          {view === "dictionary" && <DictionaryView userId={auth!.userId} />}
          {view === "snippets" && <SnippetsView userId={auth!.userId} />}
          {view === "settings" && <SettingsView />}
        </div>
      </div>
    </div>
  );
}
