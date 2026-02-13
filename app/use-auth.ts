"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type AuthState = {
  userId: Id<"users">;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
  onboardingCompleted?: boolean;
  emailVerified?: boolean;
};

const STORAGE_KEY = "ghostwriter:auth";

function loadAuthFromStorage(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.userId && parsed?.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveAuthToStorage(auth: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const signUpMutation = useMutation(api.auth.signUp);
  const loginMutation = useMutation(api.auth.login);
  const seedDictionaryMutation = useMutation(api.dictionary.seed);
  const seedSnippetsMutation = useMutation(api.snippets.seed);

  // Validate stored session on mount
  const validated = useQuery(
    api.auth.validate,
    auth?.userId ? { userId: auth.userId } : "skip",
  );

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadAuthFromStorage();
    if (stored) {
      setAuth(stored);
    }
    setLoading(false);
  }, []);

  // Sync local auth state with server-validated data (e.g. name changes),
  // or clear session if user was deleted.
  useEffect(() => {
    if (!auth || loading) return;

    if (validated === null) {
      setAuth(null);
      clearAuthStorage();
      return;
    }

    // Update local state when the server has fresher data (e.g. name, admin)
    if (
      validated &&
      (auth.name !== validated.name ||
        auth.email !== validated.email ||
        auth.firstName !== validated.firstName ||
        auth.lastName !== validated.lastName ||
        auth.profileImageUrl !== validated.profileImageUrl ||
        auth.isAdmin !== validated.isAdmin ||
        auth.onboardingCompleted !== validated.onboardingCompleted ||
        auth.emailVerified !== validated.emailVerified)
    ) {
      const updated: AuthState = {
        ...auth,
        email: validated.email,
        name: validated.name,
        firstName: validated.firstName,
        lastName: validated.lastName,
        profileImageUrl: validated.profileImageUrl,
        isAdmin: validated.isAdmin,
        onboardingCompleted: validated.onboardingCompleted,
        emailVerified: validated.emailVerified,
      };
      setAuth(updated);
      saveAuthToStorage(updated);
    }
  }, [auth, validated, loading]);

  const getDeviceId = useCallback(async () => {
    if (!window.ghostwriter) return undefined;
    try {
      return await window.ghostwriter.getDeviceId();
    } catch {
      return undefined;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const deviceId = await getDeviceId();
      const result = await signUpMutation({
        email,
        password,
        name,
        deviceId,
      });
      const authState: AuthState = {
        userId: result.userId,
        email: result.email,
        name: result.name ?? name,
        firstName: result.firstName,
        lastName: result.lastName,
        profileImageUrl: result.profileImageUrl,
        onboardingCompleted: false,
        emailVerified: false,
      };
      setAuth(authState);
      saveAuthToStorage(authState);

      // Seed the dictionary with sensible defaults (name, email, app name, etc.)
      seedDictionaryMutation({
        userId: result.userId,
        email: result.email,
        name,
      }).catch(() => {
        // Best-effort — don't block signup if seeding fails
      });

      // Seed snippets with useful starter examples
      seedSnippetsMutation({
        userId: result.userId,
        email: result.email,
      }).catch(() => {
        // Best-effort — don't block signup if seeding fails
      });

      return authState;
    },
    [signUpMutation, seedDictionaryMutation, seedSnippetsMutation, getDeviceId],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const deviceId = await getDeviceId();
      const result = await loginMutation({ email, password, deviceId });
      const authState: AuthState = {
        userId: result.userId,
        email: result.email,
        name: result.name,
        firstName: result.firstName,
        lastName: result.lastName,
        profileImageUrl: result.profileImageUrl,
        isAdmin: result.isAdmin,
        onboardingCompleted: result.onboardingCompleted,
        emailVerified: result.emailVerified,
      };
      setAuth(authState);
      saveAuthToStorage(authState);
      return authState;
    },
    [loginMutation, getDeviceId],
  );

  const logout = useCallback(() => {
    setAuth(null);
    clearAuthStorage();
  }, []);

  return {
    auth,
    loading,
    isAuthenticated: auth !== null,
    isAdmin: auth?.isAdmin ?? false,
    signUp,
    login,
    logout,
  };
}
