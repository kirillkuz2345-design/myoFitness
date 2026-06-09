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
import { syncService } from "@/services/sync.service";
import { profileService } from "@/services/profile.service";
import type { LocalProfile } from "@/db/types";

const PROFILE_SELECT_FULL =
  "id, full_name, role, trainer_id, avatar_url, gender, height_cm, weight_kg";
const PROFILE_SELECT_BASE =
  "id, full_name, role, trainer_id, avatar_url";

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

function remoteRowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role: row.role as Profile["role"],
    trainer_id: (row.trainer_id as string | null) ?? null,
    gender: (row.gender as Profile["gender"]) ?? null,
    height_cm: (row.height_cm as number | null) ?? null,
    weight_kg: (row.weight_kg as number | null) ?? null,
    sync_status: "synced",
    updated_at: Date.now(),
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbUnavailable, setDbUnavailable] = useState(false);

  const supabase = getSupabaseClient();

  async function fetchRemoteProfile(userId: string): Promise<Profile | null> {
    if (typeof navigator === "undefined" || !navigator.onLine) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_FULL)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[useAuth] Profile fetch error:", error.message);
      return null;
    }
    return data ? remoteRowToProfile(data as Record<string, unknown>) : null;
  }

  async function loadProfile(userId: string, isMounted: () => boolean): Promise<Profile | null> {
    if (!isMounted()) return null;
    try {
      const local = await profileService.getLocalProfile(userId);
      if (local) return local;
    } catch (err) {
      console.error("[useAuth] Dexie read failed:", err);
    }
    return await fetchRemoteProfile(userId);
  }

  const refreshProfile = async () => {
    if (!user?.id) return;
    const next = await loadProfile(user.id, () => true);
    setProfile(next);
  };

  useEffect(() => {
    let isMounted = true;

    // Увеличили таймаут до 6 секунд для медленных сетей Vercel
    const fallbackTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("[useAuth] Auth initialization fallback triggered. Check Supabase connection.");
        setLoading(false);
      }
    }, 6000); 

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error("[useAuth] getSession error:", error);
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
        clearTimeout(fallbackTimeout);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const initProfile = async () => {
      const p = await loadProfile(user.id, () => isMounted);
      if (isMounted) {
        setProfile(p);
        setLoading(false);
      }
    };
    initProfile();
    return () => { isMounted = false; };
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, dbUnavailable, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}