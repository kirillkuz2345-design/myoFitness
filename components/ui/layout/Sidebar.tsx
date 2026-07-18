"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Dumbbell, User, BarChart3, LayoutDashboard, LogOut } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const navItems = [
    { name: "ТРЕНИРОВКИ", href: "/client/workouts", icon: Dumbbell },
    { name: "АНАЛИТИКА", href: "/client/analytics", icon: BarChart3 },
    { name: "ПРОФИЛЬ", href: "/client/profile", icon: User },
  ];

  return (
    <div className="w-full h-full p-4 bg-[#111214]/60 flex flex-col justify-between font-mono">
      <div className="space-y-6">
        {/* ЛОГОТИП */}
        <div className="border-b border-[#222328] pb-4">
          <div className="flex items-center space-x-2">
            <LayoutDashboard className="h-4 w-4 text-[#00E676]" />
            <span className="text-xs font-black tracking-widest text-white uppercase">VIBE.CORE</span>
          </div>
          <p className="text-[8px] text-[#989AA0] uppercase tracking-wider mt-1 font-bold">ATHLETE CONSOLE v2.0</p>
        </div>

        {/* МЕНЮ НАВИГАЦИИ */}
        <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href} className="flex-1 md:flex-none">
                <div
                  className={`flex items-center space-x-2.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border
                    ${isActive 
                      ? "bg-[#00E676]/10 border-[#00E676] text-white" 
                      : "bg-transparent border-transparent text-[#989AA0] hover:text-white hover:border-[#222328]"
                    }
                  `}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#00E676]" : "text-[#515359]"}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* СИСТЕМНЫЙ ВЫХОД */}
      <div className="hidden md:block border-t border-[#222328] pt-4">
        <div onClick={handleSignOut} className="flex items-center justify-between px-2 text-[9px] font-bold text-[#515359] hover:text-red-400 transition-colors cursor-pointer uppercase">
          <span>ВЫЙТИ ИЗ СИСТЕМЫ</span>
          <LogOut className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}