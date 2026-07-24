// app/(dashboard)/client/workouts/page.tsx
"use client";

import React, { useState } from "react";
import { Card, Button, Input } from "@/components/ui/myo";
import { Dumbbell, Calendar, Trash2 } from "lucide-react";

interface ExerciseSet {
  id: string;
  reps: string;
  weight: string;
}

interface WorkoutBlock {
  id: string;
  name: string;
  sets: ExerciseSet[];
}

export default function MyoPlannerDashboard() {
  const [workoutTitle, setWorkoutTitle] = useState("Моя силовая тренировка");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  const addBlock = () => {
    const newBlock: WorkoutBlock = {
      id: crypto.randomUUID(),
      name: "",
      sets: [{ id: crypto.randomUUID(), reps: "", weight: "" }],
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBlockName = (id: string, name: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
  };

  const addSet = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          sets: [...b.sets, { id: crypto.randomUUID(), reps: "", weight: "" }],
        };
      })
    );
  };

  const removeSet = (blockId: string, setId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (b.sets.length === 1) return b;
        return { ...b, sets: b.sets.filter((s) => s.id !== setId) };
      })
    );
  };

  const updateSetData = (
    blockId: string,
    setId: string,
    field: "reps" | "weight",
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          sets: b.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      })
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">
        Конструктор тренировки
      </h2>

      {/* Дата сессии */}
      <Card className="p-4 border border-[#222328] space-y-3">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-[#00E676]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-white">Выбор даты</span>
        </div>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-xs font-mono"
        />
      </Card>

      {/* Конструктор логов тренировки */}
      <Card className="p-4 border border-[#222328] space-y-4">
        <div>
          <label className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider block mb-1.5">
            Название тренировки
          </label>
          <Input
            value={workoutTitle}
            onChange={(e) => setWorkoutTitle(e.target.value)}
            placeholder="Например: Силовая А, Ноги..."
          />
        </div>

        {/* Вывод тренировочных блоков */}
        <div className="space-y-4">
          {blocks.length === 0 ? (
            <p className="text-[9px] text-zinc-600 uppercase text-center py-6 font-bold">
              Упражнения не добавлены. Нажмите кнопку ниже.
            </p>
          ) : (
            blocks.map((block, bIdx) => (
              <div key={block.id} className="bg-[#111214]/50 border border-[#222328] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#222328] pb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[9px] font-black text-zinc-500">#{bIdx + 1}</span>
                    <Input
                      placeholder="Название упражнения..."
                      value={block.name}
                      onChange={(e) => updateBlockName(block.id, e.target.value)}
                      className="h-8 !text-xs font-bold bg-transparent border-none p-0 focus:ring-0"
                    />
                  </div>
                  <Button variant="danger" onClick={() => removeBlock(block.id)} className="h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Сеты упражнения */}
                <div className="space-y-2">
                  {block.sets.map((set, sIdx) => (
                    <div key={set.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2 text-center text-[10px] font-bold text-zinc-500 bg-[#0A0A0A] border border-[#222328] h-8 flex items-center justify-center rounded">
                        {sIdx + 1}
                      </div>
                      <div className="col-span-4">
                        <Input
                          placeholder="Вес (кг)"
                          value={set.weight}
                          onChange={(e) => updateSetData(block.id, set.id, "weight", e.target.value)}
                          className="h-8 text-center text-xs"
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          placeholder="Повторы"
                          value={set.reps}
                          onChange={(e) => updateSetData(block.id, set.id, "reps", e.target.value)}
                          className="h-8 text-center text-xs"
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Button
                          variant="secondary"
                          onClick={() => removeSet(block.id, set.id)}
                          disabled={block.sets.length === 1}
                          className="h-8 w-full !p-0 text-zinc-600 hover:text-rose-500 disabled:opacity-30"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="secondary"
                  onClick={() => addSet(block.id)}
                  className="h-6 text-[8px] border-dashed px-2 mt-1"
                >
                  + Добавить сет
                </Button>
              </div>
            ))
          )}
        </div>

        <Button
          variant="secondary"
          onClick={addBlock}
          className="w-full h-11 border-dashed border-[#222328] text-[10px] tracking-widest text-[#989AA0] hover:text-white transition-all bg-[#111214]/20"
        >
          <Dumbbell className="w-3.5 h-3.5 mr-1.5 text-zinc-600" /> Добавить упражнение
        </Button>
      </Card>
    </div>
  );
}
