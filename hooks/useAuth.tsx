"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase/client";
import { syncService } from "@/services/sync.service"; // Импортируем синк

// Безопасная инициализация
const supabase = getSupabaseClient();

export interface Profile {
  id: string;
  full_name: string | null;
  role: "trainer" | "client";
  trainer_id: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  async function fetchProfile(userId: string): Promise<void> {
    try {
      // Используем "*" для максимальной гибкости на проде
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[useAuth] Failed to fetch profile:", error.message);
        return;
      }
      setProfile(data as Profile);
    } catch (err) {
      console.error("[useAuth] Unexpected profile fetch error:", err);
    }
  }

  useEffect(() => {
    // Проверка наличия клиента
    if (!supabase) {
      console.error("[useAuth] CRITICAL: Supabase client is not initialized!");
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Авто-синк при инициализации
    if (navigator.onLine) {
        syncService.startSyncLoopIfNeeded().catch(console.error);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}