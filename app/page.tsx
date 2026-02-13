"use client";

import { DictionaryView } from "@/app/components/dictionary-view";
import { Header } from "@/app/components/header";
import { HomeView } from "@/app/components/home-view";
import { OnboardingView } from "@/app/components/onboarding-view";
import {
  SettingsModal,
  type SettingsSection,
} from "@/app/components/settings-modal";
import { Sidebar, type View } from "@/app/components/sidebar";
import { SnippetsView } from "@/app/components/snippets-view";
import { StatsView } from "@/app/components/stats-view";
import { StyleView } from "@/app/components/style-view";
import { VibeCodeView } from "@/app/components/vibecode-view";
import { LoginView } from "@/app/login-view";
import { SignUpView } from "@/app/signup-view";
import { useAuth } from "@/app/use-auth";
import { useGhostStats } from "@/app/use-ghost-stats";
import { usePreferencesSync } from "@/app/use-preferences-sync";
import { WelcomeView } from "@/app/welcome-view";
import type { StylePreferences } from "@/types/ghostwriter";
import { useCallback, useEffect, useState } from "react";

type AuthView = "welcome" | "login" | "signup";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [authView, setAuthView] = useState<AuthView>("welcome");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("general");

  const {
    auth,
    loading: authLoading,
    isAuthenticated,
    isAdmin,
    signUp,
    login,
    logout,
  } = useAuth();

  const { stats, localTranscripts, deleteTranscript } = useGhostStats(
    auth?.userId ?? null,
  );

  // Keep Convex user record in sync with local preferences
  usePreferencesSync(auth?.userId ?? null);

  // Send userId + admin flag to the main process so it can write to Convex
  // directly (used by the auto-dictionary feature) and show admin UI in tray.
  useEffect(() => {
    if (!window.ghostwriter) return;
    window.ghostwriter.setUserId(auth?.userId ?? null, isAdmin);
  }, [auth?.userId, isAdmin]);

  // Wrap signUp so we show consent prompt after a successful registration
  const handleSignUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const result = await signUp(email, password, name);
      setShowOnboarding(true);
      return result;
    },
    [signUp],
  );

  // Handle the onboarding completion (consent + style + display)
  const handleOnboardingComplete = useCallback(
    async (
      shareTranscripts: boolean,
      stylePreferences: StylePreferences,
      overlayDisplayId: number | null,
    ) => {
      try {
        await window.ghostwriter?.updateSettings({
          shareTranscripts,
          stylePreferences,
          overlayDisplayId,
        });
      } catch {
        // Settings will remain at defaults if IPC fails
      }
      setShowOnboarding(false);
    },
    [],
  );

  const openSettings = useCallback((section: SettingsSection = "general") => {
    setSettingsSection(section);
    setSettingsOpen(true);
  }, []);

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
    if (authView === "welcome") {
      return (
        <WelcomeView
          onSignIn={() => setAuthView("login")}
          onGetStarted={() => setAuthView("signup")}
        />
      );
    }
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
        onOpenSettings={() => openSettings("general")}
        collapsed={sidebarCollapsed}
        settingsOpen={settingsOpen}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={auth?.name}
          userEmail={auth?.email}
          profileImageUrl={auth?.profileImageUrl}
          onLogout={logout}
          onNavigateToSettings={() => openSettings("account")}
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
          {view === "vibecode" && <VibeCodeView />}
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          isAdmin={isAdmin}
          userId={auth!.userId}
          initialSection={settingsSection}
          onClose={() => setSettingsOpen(false)}
          onAccountDeleted={logout}
          onSignOut={logout}
        />
      )}
    </div>
  );
}
