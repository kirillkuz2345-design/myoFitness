// app/(dashboard)/trainer/analytics/page.tsx
"use client";

import React from "react";
import { BarChart3 } from "lucide-react";

export default function TrainerAnalyticsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
      <BarChart3 className="w-6 h-6 text-zinc-700" />
      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">
        Аналитика · Фаза 4
      </span>
      <span className="text-[9px] text-zinc-600 uppercase tracking-wider">В разработке</span>
    </div>
  );
}
