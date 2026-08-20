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
import { withRetry } from "@/lib/dbRetry";

// Роль нормализуется к lowercase при загрузке — единый каноничный регистр по всему приложению.
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
      const { data, error } = await withRetry(() =>
        supabase
          .from("profiles")
          .select("id, full_name, role, trainer_id, avatar_url, height, weight")
          .eq("id", userId)
          .single(),
      );

      if (error) {
        // PGRST116 = строка ещё не создана (лаг Postgres-триггера сразу после signUp).
        // Это не отказ БД — не поднимаем dbUnavailable, просто вернём null.
        if (error.code !== "PGRST116") setDbUnavailable(true);
        return null;
      }

      if (data) {
        return {
          id: data.id,
          full_name: data.full_name ?? null,
          role: String(data.role).toLowerCase() === "trainer" ? "trainer" : "client",
          trainer_id: data.trainer_id ?? null,
          avatar_url: data.avatar_url ?? null,
          height: data.height ?? null,
          weight: data.weight ?? null,
        };
      }
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

    // Страховка от вечного лоадера при зависшем ответе (инвариант проекта — 2.5с).
    const forceRenderTimeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2500);

    // onAuthStateChange сразу отдаёт INITIAL_SESSION с текущей сессией (или null).
    //
    // ВАЖНО: колбэк НЕ async и внутри него НЕ await'им supabase-запросы.
    // gotrue-js выполняет колбэк, удерживая auth-lock; любой запрос к БД внутри
    // (ему нужен токен → getSession → тот же лок) даёт дедлок — signUp/getSession
    // виснут навсегда, хотя сеть отвечает 200. Поэтому загрузку профиля выносим
    // через setTimeout(0): к этому моменту лок уже освобождён.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
      } else if (session?.user) {
        const u = session.user;
        setUser(u);
        setTimeout(() => {
          if (!isMounted) return;
          loadProfileData(u.id).then((p) => {
            if (isMounted) setProfile(p);
          });
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
      }

      if (isMounted) {
        setLoading(false);
        clearTimeout(forceRenderTimeout);
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
