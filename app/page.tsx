// app/page.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

const MAX_PROFILE_ATTEMPTS = 8; // ~4с ожидания профиля (лаг триггера после signUp)

export default function RootPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (loading) return;

    // 1. Нет сессии — на логин
    if (!user) {
      router.replace("/login");
      return;
    }

    // 2. Профиль загружен — применяем отложенную привязку и маршрутизируем по роли
    if (profile) {
      const role = profile.role?.toUpperCase();

      const routeByRole = () => {
        if (role === "TRAINER") router.replace("/trainer/clients");
        else router.replace("/client");
      };

      let pending: string | null = null;
      try {
        pending = localStorage.getItem("naore_pending_trainer");
      } catch {
        pending = null;
      }

      if (pending && role !== "TRAINER") {
        supabase
          .from("profiles")
          .update({ trainer_id: pending })
          .eq("id", user.id)
          .select("id")
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              try {
                localStorage.removeItem("naore_pending_trainer");
              } catch {
                /* ignore */
              }
            }
            routeByRole();
          });
      } else {
        routeByRole();
      }
      return;
    }

    // 3. Профиль ещё не подгрузился (лаг триггера) — ждём и перезапрашиваем,
    //    чтобы НЕ отправить тренера в клиентский кабинет по ошибке.
    if (attemptsRef.current < MAX_PROFILE_ATTEMPTS) {
      attemptsRef.current += 1;
      const t = setTimeout(() => {
        refreshProfile();
      }, 500);
      return () => clearTimeout(t);
    }

    // 4. Профиль так и не появился — крайний фолбэк, чтобы не висеть вечно
    console.warn("Профиль не загрузился после нескольких попыток — фолбэк в /client.");
    router.replace("/client");
  }, [user, profile, loading, router, refreshProfile]);

  const handleForceLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center font-mono space-y-4 p-4 text-center">
      <div className="h-5 w-5 border-2 border-[#00E676] border-t-transparent rounded-full animate-spin" />

      <div className="space-y-1">
        <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] animate-pulse block">
          Авторизация в системе...
        </span>
        {!loading && user && !profile && (
          <span className="text-[9px] text-amber-500/70 uppercase tracking-wider block max-w-xs">
            Синхронизация профиля...
          </span>
        )}
      </div>

      {!loading && (
        <button
          onClick={handleForceLogout}
          className="text-[9px] text-zinc-600 hover:text-rose-400 uppercase tracking-widest border border-zinc-900 hover:border-rose-950/40 px-3 py-1.5 rounded transition-all mt-4"
        >
          Сбросить зависшую сессию
        </button>
      )}
    </div>
  );
}
