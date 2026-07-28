// app/(dashboard)/client/workouts/[id]/page.tsx
"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: number | null;
  trainer_comment: string | null;
  client_note: string | null;
}

interface Workout {
  id: string;
  title: string;
  workout_date: string;
  recommendation: string | null;
}

interface DetailData {
  workout: Workout | null;
  exercises: Exercise[];
}

export default function ClientWorkoutDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  // Отметки выполненных подходов (локально, на время тренировки)
  const [completed, setCompleted] = useState<Record<string, boolean[]>>({});

  const toggleSet = (exId: string, i: number, total: number) => {
    setCompleted((prev) => {
      const arr = [...(prev[exId] ?? new Array(total).fill(false))];
      arr[i] = !arr[i];
      return { ...prev, [exId]: arr };
    });
  };
  const doneCount = (exId: string) => (completed[exId] ?? []).filter(Boolean).length;

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<DetailData> {
      try {
        const [wRes, exRes] = await Promise.all([
          supabase.from("workouts").select("id, title, workout_date, recommendation").eq("id", id).single(),
          supabase
            .from("exercises")
            .select("id, name, sets, reps, weight, trainer_comment, client_note")
            .eq("workout_id", id),
        ]);
        return {
          workout: (wRes.data as Workout) ?? null,
          exercises: (exRes.data as Exercise[]) ?? [],
        };
      } catch (err) {
        console.error("Ошибка загрузки тренировки:", err);
        return { workout: null, exercises: [] };
      }
    }

    load().then((data) => {
      if (cancelled) return;
      setWorkout(data.workout);
      setExercises(data.exercises);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const saveNote = async (exId: string, note: string) => {
    let prev: string | null = null;
    setExercises((cur) =>
      cur.map((e) => {
        if (e.id === exId) {
          prev = e.client_note;
          return { ...e, client_note: note };
        }
        return e;
      })
    );
    const { error } = await supabase.from("exercises").update({ client_note: note }).eq("id", exId);
    if (error) {
      console.error("Ошибка сохранения заметки:", error);
      toast.error("Не удалось сохранить заметку");
      setExercises((cur) => cur.map((e) => (e.id === exId ? { ...e, client_note: prev } : e)));
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-[#989AA0] uppercase tracking-widest animate-pulse">
        Загрузка тренировки...
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-[#989AA0] hover:text-[#00E676] flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
        <div className="text-center py-10 text-[10px] text-zinc-600 uppercase border border-dashed border-[#1C1C1E] rounded-2xl">
          Тренировка не найдена
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-xs text-[#989AA0] hover:text-[#00E676] flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Назад
      </button>

      <div className="space-y-1">
        <h2 className="text-sm font-black uppercase tracking-widest text-white">{workout.title}</h2>
        <p className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider">{workout.workout_date}</p>
      </div>

      {workout.recommendation && (
        <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 text-[11px] text-gray-300">
          <span className="block mb-1 text-[8px] font-bold uppercase tracking-[0.2em] text-[#00E676]">
            Рекомендации тренера
          </span>
          {workout.recommendation}
        </div>
      )}

      <div className="space-y-3">
        {exercises.length === 0 ? (
          <div className="text-center py-8 text-[10px] text-zinc-600 uppercase border border-dashed border-[#1C1C1E] rounded-2xl">
            В тренировке нет упражнений
          </div>
        ) : (
          exercises.map((ex, idx) => (
            <div key={ex.id} className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">
                  <span className="text-zinc-500 mr-1.5">#{idx + 1}</span>
                  {ex.name}
                </span>
                <span className="text-[10px] text-gray-400 bg-[#0A0A0A] px-2 py-0.5 border border-[#1C1C1E] rounded">
                  {ex.sets}×{ex.reps} {ex.weight ? `· ${ex.weight} кг` : ""}
                </span>
              </div>

              {/* Индикаторы подходов */}
              {ex.sets > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Подходы</span>
                    <span className="text-[9px] font-black text-[#00E676]">
                      {doneCount(ex.id)}/{ex.sets}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: ex.sets }).map((_, i) => {
                      const isDone = (completed[ex.id] ?? [])[i] ?? false;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleSet(ex.id, i, ex.sets)}
                          aria-label={`Подход ${i + 1}`}
                          className={`h-8 w-8 rounded-lg border text-[11px] font-black flex items-center justify-center transition-colors ${
                            isDone
                              ? "bg-[#00E676] border-[#00E676] text-black"
                              : "bg-[#0A0A0A] border-[#1C1C1E] text-[#989AA0] hover:border-[#00E676]/40"
                          }`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {ex.trainer_comment && (
                <div className="bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg p-2.5 text-[11px] text-gray-300">
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-[#989AA0] mb-1">
                    Комментарий тренера
                  </span>
                  {ex.trainer_comment}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                  Ваша обратная связь
                </label>
                <input
                  type="text"
                  defaultValue={ex.client_note || ""}
                  onBlur={(e) => saveNote(ex.id, e.target.value)}
                  placeholder="Как прошло? Что по ощущениям..."
                  className="w-full bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#00E676]"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
