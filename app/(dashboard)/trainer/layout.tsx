// app/(dashboard)/trainer/layout.tsx
"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Settings,
  Users,
  CalendarDays,
  MessageSquare,
  BarChart3,
  Wallet,
  LogOut,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  action?: "logout";
}

const NAV: NavItem[] = [
  { key: "clients", label: "Атлеты", icon: Users, href: "/trainer/clients" },
  { key: "calendar", label: "Календарь", icon: CalendarDays, href: "/trainer/calendar" },
  { key: "chat", label: "Чат", icon: MessageSquare, href: "/trainer/chat" },
  { key: "analytics", label: "Аналитика", icon: BarChart3, href: "/trainer/analytics" },
  { key: "payments", label: "Оплаты", icon: Wallet, href: "/trainer/payments" },
  { key: "logout", label: "Выход", icon: LogOut, href: "/login", action: "logout" },
];

export default function TrainerRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (item: NavItem): boolean => {
    if (item.action === "logout") return false;
    return pathname.startsWith(item.href);
  };

  const handleNav = async (item: NavItem) => {
    if (item.action === "logout") {
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }
    router.push(item.href);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased">
      {/* Шапка NAORE */}
      <header
        className="sticky top-0 z-40 border-b border-[#1C1C1E] bg-[#0A0A0A]/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-3xl px-5 h-16 flex items-center justify-between">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
            NAORE <span className="text-[#00E676]">FITNESS</span>
            <span className="ml-2 text-[8px] font-bold text-[#989AA0] align-middle">ТРЕНЕР</span>
          </h1>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            aria-label="Настройки"
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#262626] bg-[#111214] text-[#989AA0] hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Контент */}
      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">{children}</main>

      {/* Нижняя навигация */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[#1C1C1E] bg-[#0A0A0A]/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-3xl px-1 h-16 flex items-center justify-between">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNav(item)}
                className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${
                  active ? "text-[#00E676]" : "text-[#989AA0] hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8px] font-bold uppercase tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
