"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // Используем наш единый клиент
import { User, Shield, Mail } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "client" | "trainer"; // Каноничный lowercase, как в БД
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false; // Guard от setState после размонтирования

    async function fetchProfileData() {
      try {
        // 1. Текущий юзер из сессии auth (email живёт здесь, не в profiles)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Метаданные профиля. В таблице profiles: id, full_name, role.
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (data && !cancelled) {
          const normalizedRole =
            String(data.role).toLowerCase() === "trainer" ? "trainer" : "client";
          setProfile({
            id: data.id,
            name: data.full_name ?? "",
            email: user.email ?? "",
            role: normalizedRole,
          });
        }
      } catch (err) {
        console.error("Ошибка при загрузке профиля:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfileData();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-[#989AA0] uppercase tracking-widest animate-pulse">
        Синхронизация профиля с облаком...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Профиль атлета</h2>

      <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-5 space-y-6">
        {/* Хедер карточки */}
        <div className="border-b border-[#1C1C1E] pb-4">
          <h1 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[#00E676]" />
            Профиль атлета
          </h1>
          <p className="text-[10px] text-[#989AA0] mt-1">Данные синхронизированы с облаком</p>
        </div>

        {/* Контент профиля */}
        <div className="space-y-4 text-xs">
          <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#1C1C1E] rounded-lg">
            <span className="text-[#989AA0] flex items-center gap-1.5">Имя:</span>
            <span className="text-white font-bold">{profile?.name || "Не указано"}</span>
          </div>

          <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#1C1C1E] rounded-lg">
            <span className="text-[#989AA0] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#989AA0]" /> Email:
            </span>
            <span className="text-gray-300 font-mono">{profile?.email || "—"}</span>
          </div>

          <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#1C1C1E] rounded-lg">
            <span className="text-[#989AA0] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#989AA0]" /> Доступ:
            </span>
            <span
              className={`font-bold tracking-wider uppercase text-[10px] px-2 py-0.5 rounded ${
                profile?.role === "trainer"
                  ? "bg-purple-950 text-purple-400 border border-purple-800"
                  : "bg-[#0E2A1C] text-[#00E676] border border-[#16423C]"
              }`}
            >
              {profile?.role === "trainer" ? "Наставник" : "Спортсмен"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
