"use client";

import React from "react";
import { Card } from "@/components/ui/myo";

export default function ProfilePage() {
  return (
    <div className="p-6 font-mono text-[#E1E3E6]">
      <Card className="p-4">
        <h1 className="text-xs font-black uppercase tracking-widest text-white">Профиль Атлета</h1>
        {/* Контент профиля пользователя */}
        <p className="text-[10px] text-[#989AA0] mt-1">Данные синхронизированы с облаком</p>
      </Card>
    </div>
  );
}
