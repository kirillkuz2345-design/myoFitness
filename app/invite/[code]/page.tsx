// app/invite/[code]/page.tsx
"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { CheckCircle2, AlertTriangle, LogIn } from "lucide-react";

type Status = "working" | "ok" | "error" | "need-login" | "trainer";

// code = id тренера. Залогиненный атлет, открывший ссылку, привязывается к нему.
export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [status, setStatus] = useState<Status>("working");

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    async function bind(): Promise<Status> {
      if (!user) {
        // Сохраняем код, чтобы привязать после входа/регистрации (см. app/page.tsx)
        try {
          localStorage.setItem("naore_pending_trainer", code);
        } catch {
          /* localStorage недоступен — не критично */
        }
        return "need-login";
      }
      if (profile?.role?.toUpperCase() === "TRAINER") return "trainer";
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ trainer_id: code })
          .eq("id", user.id);
        if (error) throw error;
        return "ok";
      } catch (err) {
        console.error("Ошибка привязки по ссылке:", err);
        return "error";
      }
    }

    bind().then((s) => {
      if (cancelled) return;
      setStatus(s);
      if (s === "ok") setTimeout(() => router.replace("/client"), 1400);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, user, profile, code, router]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased flex flex-col items-center justify-center p-6 text-center space-y-4">
      <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
        NAORE <span className="text-[#00E676]">FITNESS</span>
      </h1>

      {status === "working" && (
        <>
          <div className="h-5 w-5 border-2 border-[#00E676] border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Привязка к тренеру...</span>
        </>
      )}

      {status === "ok" && (
        <>
          <CheckCircle2 className="w-8 h-8 text-[#00E676]" />
          <span className="text-xs text-white font-bold uppercase tracking-wider">Готово — вы привязаны к тренеру</span>
          <span className="text-[10px] text-zinc-500 uppercase">Переходим в кабинет...</span>
        </>
      )}

      {status === "trainer" && (
        <>
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <span className="text-xs text-white font-bold uppercase tracking-wider text-center">
            Вы вошли как тренер — по ссылке привязывается только атлет
          </span>
          <button
            type="button"
            onClick={() => router.replace("/trainer/clients")}
            className="text-[10px] text-[#00E676] uppercase tracking-widest"
          >
            В кабинет тренера
          </button>
        </>
      )}

      {status === "need-login" && (
        <>
          <LogIn className="w-8 h-8 text-[#989AA0]" />
          <span className="text-xs text-white font-bold uppercase tracking-wider">Войдите, чтобы привязаться</span>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="bg-[#00E676] text-black font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest"
          >
            Войти
          </button>
          <span className="text-[9px] text-zinc-600 uppercase">После входа откройте ссылку ещё раз</span>
        </>
      )}

      {status === "error" && (
        <>
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <span className="text-xs text-white font-bold uppercase tracking-wider">Не удалось привязаться</span>
          <button
            type="button"
            onClick={() => router.replace("/client")}
            className="text-[10px] text-[#00E676] uppercase tracking-widest"
          >
            В кабинет
          </button>
        </>
      )}
    </div>
  );
}
