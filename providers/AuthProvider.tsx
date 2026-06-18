// providers/AuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase/client";
import { profileService } from "@/services/profile.service"; 
import { syncService } from "@/services/sync.service"; 
import type { LocalProfile } from "@/db/types";

export type Profile = LocalProfile;

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  dbUnavailable: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbUnavailable, setDbUnavailable] = useState(false);

  const supabase = getSupabaseClient();

  async function loadProfileData(userId: string): Promise<Profile | null> {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));

    const fetchPromise = async (): Promise<Profile | null> => {
      try {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          const hydrated = await profileService.hydrateProfileIfOnline(userId);
          if (hydrated) return hydrated;
        }

        const local = await profileService.getLocalProfile(userId);
        if (local) return local;
      } catch (err) {
        console.error("[useAuth] Failed to load profile data core:", err);
        setDbUnavailable(true);
      }
      return null;
    };

    return Promise.race([fetchPromise(), timeoutPromise]);
  }

  const refreshProfile = async () => {
    if (!user?.id) return;
    const next = await loadProfileData(user.id);
    setProfile(next);
  };

  useEffect(() => {
    if (!supabase) {
      console.error("[useAuth] CRITICAL: Supabase client is not initialized!");
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fallbackTimeout = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
      }
    }, 5000);

    async function handleAuthResolution(currentUser: User | null) {
      if (!isMounted) return;

      if (currentUser) {
        setUser(currentUser);
        const p = await loadProfileData(currentUser.id);
        if (isMounted) {
          setProfile(p);
        }

        if (typeof navigator !== "undefined" && navigator.onLine) {
          syncService.startSyncLoopIfNeeded().catch((err) =>
            console.error("[useAuth] Фоновая синхронизация не запустилась:", err)
          );
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      if (isMounted) {
        setLoading(false);
        clearTimeout(fallbackTimeout);
      }
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error("[useAuth] getSession error:", error);
      if (!isMounted) return;
      
      if (session?.user) {
        handleAuthResolution(session.user);
      } else if (!session) {
        handleAuthResolution(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setLoading(false);
        clearTimeout(fallbackTimeout);
      } else if (session?.user) {
        handleAuthResolution(session.user);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, dbUnavailable, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}