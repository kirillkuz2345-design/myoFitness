"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // Используем наш единый клиент
import { User, Shield, Mail, Key } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "client" | "trainer"; // Каноничный lowercase, как в БД
  invite_code?: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false; // Guard от setState после размонтирования

    async function fetchProfileData() {
      try {
        // 1. Получаем текущего юзера из сессии auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Тянем метаданные из таблицы profiles (включая инвайт-код)
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, email, role, invite_code")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (data && !cancelled) {
          // Нормализуем роль к lowercase — в БД регистр может быть непостоянным
          const normalizedRole =
            String(data.role).toLowerCase() === "trainer" ? "trainer" : "client";
          setProfile({
            id: data.id,
            name: data.name,
            email: data.email,
            role: normalizedRole,
            invite_code: data.invite_code ?? undefined,
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
      <div className="p-6 font-mono text-center text-xs text-[#989AA0]">
        Синхронизация профиля с облаком...
      </div>
    );
  }

  return (
    <div className="p-6 font-mono text-[#E1E3E6] max-w-md mx-auto animate-fadeIn">
      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 shadow-xl space-y-6">

        {/* Хедер карточки */}
        <div className="border-b border-[#262626] pb-4">
          <h1 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[#00F5D4]" />
            Профиль Атлета
          </h1>
          <p className="text-[10px] text-[#989AA0] mt-1">Данные синхронизированы с облаком</p>
        </div>

        {/* Контент профиля */}
        <div className="space-y-4 text-xs">
          <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#262626] rounded-lg">
            <span className="text-[#989AA0] flex items-center gap-1.5">
              Имя:
            </span>
            <span className="text-white font-bold">{profile?.name || "Не указано"}</span>
          </div>

          <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#262626] rounded-lg">
            <span className="text-[#989AA0] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-500" /> Email:
            </span>
            <span className="text-gray-300 font-mono">{profile?.email}</span>
          </div>

          <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#262626] rounded-lg">
            <span className="text-[#989AA0] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-gray-500" /> Доступ:
            </span>
            <span className={`font-bold tracking-wider uppercase text-[10px] px-2 py-0.5 rounded ${
              profile?.role === "trainer" ? "bg-purple-950 text-purple-400 border border-purple-800" : "bg-[#1F2E2B] text-[#00F5D4] border border-[#16423C]"
            }`}>
              {profile?.role === "trainer" ? "Наставник" : "Спортсмен"}
            </span>
          </div>

          {/* Если зашел тренер — выводим его мастер-код */}
          {profile?.role === "trainer" && profile.invite_code && (
            <div className="bg-[#1a140a] border border-[#423116] p-3 rounded-lg flex justify-between items-center">
              <span className="text-[#c2a272] font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Ваш Инвайт-код:
              </span>
              <span className="font-mono text-white bg-[#0A0A0A] px-2 py-1 border border-[#262626] rounded text-sm font-bold tracking-widest selection:bg-[#00F5D4]">
                {profile.invite_code}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
