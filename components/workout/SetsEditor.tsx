// components/workout/SetsEditor.tsx
"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DraftSetInput } from "@/lib/exerciseSets";

interface Props {
  sets: DraftSetInput[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: "reps" | "weight", value: string) => void;
}

export default function SetsEditor({ sets, onAdd, onRemove, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
          Подходы ({sets.length})
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
        >
          <Plus className="w-3 h-3" /> Подход
        </button>
      </div>

      {sets.map((s, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-2 text-center text-[10px] font-bold text-zinc-500 bg-[#0A0A0A] border border-[#1C1C1E] h-8 flex items-center justify-center rounded">
            {i + 1}
          </div>
          <input
            value={s.reps}
            onChange={(e) => onChange(i, "reps", e.target.value)}
            placeholder="Повторы"
            className="col-span-4 bg-[#111214] border border-[#1C1C1E] rounded px-2 h-8 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
          />
          <input
            value={s.weight}
            onChange={(e) => onChange(i, "weight", e.target.value)}
            inputMode="decimal"
            placeholder="Вес, кг"
            className="col-span-4 bg-[#111214] border border-[#1C1C1E] rounded px-2 h-8 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            disabled={sets.length === 1}
            aria-label="Удалить подход"
            className="col-span-2 flex justify-center text-zinc-600 hover:text-rose-500 disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
