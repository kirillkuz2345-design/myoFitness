// app/page.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // 1. Нет сессии — на логин (код приглашения уже сохранён на /invite)
    if (!user) {
      router.replace("/login");
      return;
    }

    const userRole = profile?.role?.toUpperCase();

    // 2. Применяем отложенную привязку по инвайт-ссылке (после входа/регистрации).
    //    Тренера не привязываем.
    async function applyPendingAndRoute() {
      let pending: string | null = null;
      try {
        pending = localStorage.getItem("naore_pending_trainer");
      } catch {
        pending = null;
      }

      if (pending && userRole !== "TRAINER" && user) {
        try {
          const { data: updated, error } = await supabase
            .from("profiles")
            .update({ trainer_id: pending })
            .eq("id", user.id)
            .select("id");
          // Чистим код только если апдейт реально прошёл (профиль уже существует)
          if (!error && updated && updated.length > 0) {
            try {
              localStorage.removeItem("naore_pending_trainer");
            } catch {
              /* ignore */
            }
          }
        } catch (err) {
          console.error("Ошибка привязки по инвайту:", err);
        }
      }

      if (!profile) {
        console.warn("Сессия найдена, но профиль в таблице profiles отсутствует.");
        router.replace("/client");
        return;
      }
      if (userRole === "TRAINER") router.replace("/trainer/clients");
      else router.replace("/client");
    }

    applyPendingAndRoute();
  }, [user, profile, loading, router]);

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
            Синхронизация структуры БД задерживается. Направляем в кабинет...
          </span>
        )}
      </div>

      {/* Аварийная кнопка на случай полного сбоя сессии */}
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
