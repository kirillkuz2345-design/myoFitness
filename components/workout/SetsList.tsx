// components/workout/SetsList.tsx
"use client";

import React from "react";
import type { SetEntry } from "@/lib/exerciseSets";

export default function SetsList({ entries }: { entries: SetEntry[] }) {
  if (entries.length === 0) {
    return <div className="text-[10px] text-zinc-600 italic">Подходы не заданы</div>;
  }
  return (
    <div className="space-y-1">
      {entries.map((s, i) => (
        <div
          key={i}
          className="flex items-center justify-between text-[11px] bg-[#0A0A0A] border border-[#1C1C1E] rounded px-2.5 py-1.5"
        >
          <span className="text-zinc-500 font-bold">Подход {i + 1}</span>
          <span className="text-white font-mono">
            {s.reps || "—"} повт · {s.weight != null ? `${s.weight} кг` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
