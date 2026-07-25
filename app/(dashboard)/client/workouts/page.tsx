// app/(dashboard)/client/workouts/page.tsx
"use client";

import React, { useState } from "react";
import { Card, Button, Input } from "@/components/ui/myo";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Dumbbell, Calendar, Trash2 } from "lucide-react";

interface DraftExercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  trainerComment: string;
  clientNote: string;
}

export default function MyoPlannerDashboard() {
  const { user, loading } = useAuth();
  const [workoutTitle, setWorkoutTitle] = useState("Моя силовая тренировка");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [saving, setSaving] = useState(false);

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", sets: "", reps: "", weight: "", trainerComment: "", clientNote: "" },
    ]);
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const updateExercise = (id: string, field: keyof Omit<DraftExercise, "id">, value: string) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const handleSave = async () => {
    if (!workoutTitle.trim() || !selectedDate) {
      toast.error("Укажите название и дату");
      return;
    }
    if (!user?.id) {
      toast.error("Сессия не найдена");
      return;
    }
    setSaving(true);
    try {
      // 1. Тренировка от лица атлета (client_id = creator_id = сам)
      const { data: wRow, error: wErr } = await supabase
        .from("workouts")
        .insert({
          client_id: user.id,
          creator_id: user.id,
          title: workoutTitle.trim(),
          workout_date: selectedDate,
        })
        .select("id")
        .single();

      if (wErr) throw wErr;
      const newId: string = wRow.id;

      // 2. Упражнения (только заполненные)
      const rows = exercises
        .filter((e) => e.name.trim())
        .map((e) => ({
          workout_id: newId,
          name: e.name.trim(),
          sets: Number(e.sets) || 0,
          reps: e.reps.trim(),
          weight: e.weight.trim() === "" ? null : Number(e.weight),
          trainer_comment: e.trainerComment.trim() || null,
          client_note: e.clientNote.trim() || null,
        }));

      if (rows.length > 0) {
        const { error: exErr } = await supabase.from("exercises").insert(rows);
        if (exErr) throw exErr;
      }

      toast.success("Тренировка сохранена");
      setExercises([]);
      setWorkoutTitle("Моя силовая тренировка");
    } catch (err) {
      console.error("Ошибка сохранения тренировки:", err);
      toast.error("Не удалось сохранить тренировку");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-mono">
        <span className="text-xs text-zinc-500 uppercase tracking-widest animate-pulse">Загрузка...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">
        Конструктор тренировки
      </h2>

      {/* Дата */}
      <Card className="p-4 border border-[#1C1C1E] space-y-3 rounded-2xl">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-[#00E676]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-white">Дата</span>
        </div>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-xs font-mono"
        />
      </Card>

      {/* Конструктор */}
      <Card className="p-4 border border-[#1C1C1E] space-y-4 rounded-2xl">
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

        <div className="space-y-4">
          {exercises.length === 0 ? (
            <p className="text-[9px] text-zinc-600 uppercase text-center py-6 font-bold">
              Упражнения не добавлены. Нажмите кнопку ниже.
            </p>
          ) : (
            exercises.map((ex, idx) => (
              <div key={ex.id} className="bg-[#0A0A0A] border border-[#1C1C1E] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#1C1C1E] pb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[9px] font-black text-zinc-500">#{idx + 1}</span>
                    <Input
                      placeholder="Название упражнения..."
                      value={ex.name}
                      onChange={(e) => updateExercise(ex.id, "name", e.target.value)}
                      className="h-8 !text-xs font-bold bg-transparent border-none p-0 focus:ring-0"
                    />
                  </div>
                  <Button variant="danger" onClick={() => removeExercise(ex.id)} className="h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Подходы"
                    value={ex.sets}
                    inputMode="numeric"
                    onChange={(e) => updateExercise(ex.id, "sets", e.target.value)}
                    className="h-8 text-center text-xs"
                  />
                  <Input
                    placeholder="Повторы"
                    value={ex.reps}
                    onChange={(e) => updateExercise(ex.id, "reps", e.target.value)}
                    className="h-8 text-center text-xs"
                  />
                  <Input
                    placeholder="Вес, кг"
                    value={ex.weight}
                    inputMode="decimal"
                    onChange={(e) => updateExercise(ex.id, "weight", e.target.value)}
                    className="h-8 text-center text-xs"
                  />
                </div>

                <Input
                  placeholder="Комментарий тренера"
                  value={ex.trainerComment}
                  onChange={(e) => updateExercise(ex.id, "trainerComment", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Комментарий подопечного"
                  value={ex.clientNote}
                  onChange={(e) => updateExercise(ex.id, "clientNote", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            ))
          )}
        </div>

        <Button
          variant="secondary"
          onClick={addExercise}
          className="w-full h-11 border-dashed border-[#1C1C1E] text-[10px] tracking-widest text-[#989AA0] hover:text-white transition-all bg-[#0A0A0A]/20"
        >
          <Dumbbell className="w-3.5 h-3.5 mr-1.5 text-zinc-600" /> Добавить упражнение
        </Button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#00E676] text-black font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50 transition-colors hover:bg-[#00c765]"
        >
          {saving ? "Сохранение..." : "Сохранить тренировку"}
        </button>
      </Card>
    </div>
  );
}
