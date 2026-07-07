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
import { supabase } from "@/lib/supabase";

// Временная безопасная типизация для исключения ошибок TS2307
export type LocalProfile = {
  id: string;
  full_name: string | null;
  role: "client" | "trainer";
  trainer_id?: string | null;
  avatar_url?: string | null;
  height?: number | null;
  weight?: number | null;
};

interface AuthContextType {
  user: User | null;
  profile: LocalProfile | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbUnavailable, setDbUnavailable] = useState(false);

  async function loadProfileData(userId: string): Promise<LocalProfile | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error && data) return data as LocalProfile;
    } catch (err) {
      console.error("[useAuth] Profile load error:", err);
      setDbUnavailable(true);
    }
    return null;
  }

  const refreshProfile = async () => {
    if (!user?.id) return;
    const next = await loadProfileData(user.id);
    setProfile(next);
  };

  useEffect(() => {
    let isMounted = true;

    const forceRenderTimeout = setTimeout(() => {
      if (isMounted && loading) setLoading(false);
    }, 2500);

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user && isMounted) {
          setUser(session.user);
          const p = await loadProfileData(session.user.id);
          if (isMounted) setProfile(p);
        }
      } catch (err) {
        console.error("[useAuth] Init error:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          clearTimeout(forceRenderTimeout);
        }
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        const p = await loadProfileData(session.user.id);
        if (isMounted) setProfile(p);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(forceRenderTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, dbUnavailable, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}