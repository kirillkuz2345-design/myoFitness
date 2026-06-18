"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/myo";
import { WorkoutRoutine } from "@/db/types";

export default function AnalyticsPage() {
  // Исправлено: Ленивая загрузка кэша убирает каскадный рендеринг
  const [routines] = useState<WorkoutRoutine[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("routines");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error("Ошибка загрузки истории для аналитики", e);
        }
      }
    }
    return [];
  });

  return (
    <div className="p-6 space-y-4 font-mono text-[#E1E3E6]">
      <Card className="p-4">
        <h1 className="text-xs font-black uppercase tracking-widest text-white">Аналитика тренировок</h1>
        {/* Исправлено: JSX-комментарий теперь валиден */}
        <p className="text-[10px] text-[#989AA0] mt-2">Всего тренировок проведено: {routines.length}</p>
      </Card>
    </div>
  );
}