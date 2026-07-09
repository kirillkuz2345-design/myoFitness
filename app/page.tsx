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
    // 1. Если загрузка завершилась, а сессии нет — на логин
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    // 2. Если сессия есть, загрузка завершена, но профиль пустой (баг триггера/БД)
    if (!loading && user && !profile) {
      console.warn("Сессия найдена, но профиль в таблице profiles отсутствует.");
      // Вместо бесконечного лоадера отправляем пользователя в дефолтную зону атлета
      router.replace("/client/workouts");
      return;
    }

    // 3. Если профиль успешно загружен
    if (!loading && profile) {
      const userRole = profile.role?.toUpperCase();

      if (userRole === "TRAINER") {
        router.replace("/trainer/clients"); 
      } else {
        router.replace("/client/workouts");
      }
    }
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
            Синхронизация структуры БД задерживается. Направляем в консоль...
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