"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

// Плавающая кнопка настроек: показывается только авторизованным пользователям,
// чтобы гости на /login и /register не видели вход в защищённую зону.
export default function SettingsFab() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <Link
      href="/settings"
      className="fixed bottom-6 right-6 z-50 p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 group backdrop-blur-md"
      title="Личные настройки"
    >
      <User size={22} className="group-hover:animate-pulse" />
    </Link>
  );
}
