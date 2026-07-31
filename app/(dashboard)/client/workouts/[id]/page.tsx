// app/(dashboard)/client/workouts/[id]/page.tsx
"use client";

import React, { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { withRetry } from "@/lib/dbRetry";
import { useAuth } from "@/providers/AuthProvider";
import toast from "react-hot-toast";
import { ArrowLeft, Pencil, Plus, X, Trash2 } from "lucide-react";

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
  creator_id: string;
}

interface DraftExercise {
  tempId: string;
  id?: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

interface DetailData {
  workout: Workout | null;
  exercises: Exercise[];
}

export default function ClientWorkoutDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Record<string, boolean[]>>({});

  // Редактор (только для своих тренировок)
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eDate, setEDate] = useState("");
  const [eEx, setEEx] = useState<DraftExercise[]>([]);
  const [eOriginalIds, setEOriginalIds] = useState<string[]>([]);

  const load = useCallback(async (): Promise<DetailData> => {
    try {
      const [wRes, exRes] = await Promise.all([
        supabase.from("workouts").select("id, title, workout_date, recommendation, creator_id").eq("id", id).single(),
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
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    load().then((data) => {
      if (cancelled) return;
      setWorkout(data.workout);
      setExercises(data.exercises);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = async () => {
    const data = await load();
    setWorkout(data.workout);
    setExercises(data.exercises);
  };

  const isOwn = !!workout && !!user && workout.creator_id === user.id;

  const toggleSet = (exId: string, i: number, total: number) => {
    setCompleted((prev) => {
      const arr = [...(prev[exId] ?? new Array(total).fill(false))];
      arr[i] = !arr[i];
      return { ...prev, [exId]: arr };
    });
  };
  const doneCount = (exId: string) => (completed[exId] ?? []).filter(Boolean).length;

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

  // ── Редактор своей тренировки ────────────────────────────────
  const openEdit = () => {
    if (!workout) return;
    setETitle(workout.title);
    setEDate(workout.workout_date);
    const drafts: DraftExercise[] = exercises.map((ex) => ({
      tempId: crypto.randomUUID(),
      id: ex.id,
      name: ex.name,
      sets: ex.sets != null ? String(ex.sets) : "",
      reps: ex.reps ?? "",
      weight: ex.weight != null ? String(ex.weight) : "",
    }));
    setEEx(drafts);
    setEOriginalIds(drafts.map((d) => d.id as string));
    setShowEdit(true);
  };

  const addEx = () =>
    setEEx((prev) => [...prev, { tempId: crypto.randomUUID(), name: "", sets: "", reps: "", weight: "" }]);
  const removeEx = (tempId: string) => setEEx((prev) => prev.filter((d) => d.tempId !== tempId));
  const updEx = (tempId: string, field: keyof Omit<DraftExercise, "tempId" | "id">, value: string) =>
    setEEx((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d)));

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workout) return;
    if (!eTitle.trim() || !eDate) {
      toast.error("Укажите название и дату");
      return;
    }
    setSaving(true);
    try {
      const { error: wErr } = await withRetry(() =>
        supabase.from("workouts").update({ title: eTitle.trim(), workout_date: eDate }).eq("id", workout.id)
      );
      if (wErr) throw wErr;

      const filled = eEx.filter((d) => d.name.trim());

      // Обновляем существующие (trainer_comment не трогаем — это поле тренера)
      for (const d of filled.filter((d) => d.id)) {
        const { error } = await withRetry(() =>
          supabase
            .from("exercises")
            .update({
              name: d.name.trim(),
              sets: Number(d.sets) || 0,
              reps: d.reps.trim(),
              weight: d.weight.trim() === "" ? null : Number(d.weight),
            })
            .eq("id", d.id as string)
        );
        if (error) throw error;
      }

      const newRows = filled
        .filter((d) => !d.id)
        .map((d) => ({
          workout_id: workout.id,
          name: d.name.trim(),
          sets: Number(d.sets) || 0,
          reps: d.reps.trim(),
          weight: d.weight.trim() === "" ? null : Number(d.weight),
        }));
      if (newRows.length > 0) {
        const { error } = await withRetry(() => supabase.from("exercises").insert(newRows));
        if (error) throw error;
      }

      const keep = new Set(filled.filter((d) => d.id).map((d) => d.id as string));
      const toDelete = eOriginalIds.filter((x) => !keep.has(x));
      if (toDelete.length > 0) {
        const { error } = await withRetry(() => supabase.from("exercises").delete().in("id", toDelete));
        if (error) throw error;
      }

      await reload();
      toast.success("Тренировка обновлена");
      setShowEdit(false);
    } catch (err) {
      console.error("Ошибка сохранения тренировки:", err);
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
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
        <button type="button" onClick={() => router.back()} className="text-xs text-[#989AA0] hover:text-[#00E676] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
        <div className="text-center py-10 text-[10px] text-zinc-600 uppercase border border-dashed border-[#1C1C1E] rounded-2xl">
          Тренировка не найдена
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676] transition-colors";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => router.back()} className="text-xs text-[#989AA0] hover:text-[#00E676] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
        {isOwn && (
          <button
            type="button"
            onClick={openEdit}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-[#00E676] text-black px-3 py-1.5 rounded-lg hover:bg-[#00c765] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Изменить
          </button>
        )}
      </div>

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

      {/* Модалка редактирования (только своя тренировка) */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Редактировать тренировку</h3>
              <button type="button" onClick={() => setShowEdit(false)} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Название</label>
                  <input value={eTitle} onChange={(e) => setETitle(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Дата</label>
                  <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Упражнения ({eEx.length})
                  </span>
                  <button
                    type="button"
                    onClick={addEx}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>

                {eEx.map((d, idx) => (
                  <div key={d.tempId} className="bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-zinc-500">#{idx + 1}</span>
                      <input
                        value={d.name}
                        onChange={(e) => updEx(d.tempId, "name", e.target.value)}
                        placeholder="Название упражнения"
                        className="flex-1 bg-transparent text-xs font-bold text-white outline-none"
                      />
                      <button type="button" onClick={() => removeEx(d.tempId)} aria-label="Удалить" className="text-zinc-600 hover:text-rose-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={d.sets}
                        onChange={(e) => updEx(d.tempId, "sets", e.target.value)}
                        inputMode="numeric"
                        placeholder="Подходы"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                      <input
                        value={d.reps}
                        onChange={(e) => updEx(d.tempId, "reps", e.target.value)}
                        placeholder="Повторы"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                      <input
                        value={d.weight}
                        onChange={(e) => updEx(d.tempId, "weight", e.target.value)}
                        inputMode="decimal"
                        placeholder="Вес, кг"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#00E676] text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
