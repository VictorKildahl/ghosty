"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type AuthState = {
  userId: Id<"users">;
  email: string;
  name?: string;
};

const STORAGE_KEY = "ghosttype:auth";

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

  // If validation returns null (user deleted), clear session
  useEffect(() => {
    if (auth && validated === null && !loading) {
      setAuth(null);
      clearAuthStorage();
    }
  }, [auth, validated, loading]);

  const getDeviceId = useCallback(async () => {
    if (!window.ghosttype) return undefined;
    try {
      return await window.ghosttype.getDeviceId();
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
        name: name,
      };
      setAuth(authState);
      saveAuthToStorage(authState);
      return authState;
    },
    [signUpMutation, getDeviceId],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const deviceId = await getDeviceId();
      const result = await loginMutation({ email, password, deviceId });
      const authState: AuthState = {
        userId: result.userId,
        email: result.email,
        name: result.name,
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
    signUp,
    login,
    logout,
  };
}
