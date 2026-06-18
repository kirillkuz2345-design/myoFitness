"use client";

import React from "react";
import Sidebar from "@/components/ui/layout/Sidebar";

export default function ClientRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased">
      {/* Боковая панель */}
      <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-[#222328]">
        <Sidebar />
      </div>

      {/* Основной контент */}
      <main className="flex-1 w-full min-w-0 p-4 md:p-6 overflow-x-hidden overflow-y-auto">
        {children}
      </main>
    </div>
  );
}