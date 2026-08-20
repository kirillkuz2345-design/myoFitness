// app/(dashboard)/client/workouts/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/ui/myo";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { withRetry } from "@/lib/dbRetry";
import { buildSetsPayload, emptyDraftSet, type DraftSetInput } from "@/lib/exerciseSets";
import SetsEditor from "@/components/workout/SetsEditor";
import toast from "react-hot-toast";
import { Dumbbell, Calendar, Trash2, ChevronRight } from "lucide-react";

interface DraftExercise {
  id: string;
  name: string;
  sets: DraftSetInput[];
}

interface WorkoutSummary {
  id: string;
  title: string;
  workout_date: string;
}

export default function MyoPlannerDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [workoutTitle, setWorkoutTitle] = useState("Моя силовая тренировка");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [archive, setArchive] = useState<WorkoutSummary[]>([]);

  const loadArchive = useCallback(async (): Promise<WorkoutSummary[] | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, title, workout_date")
        .eq("client_id", user.id)
        .order("workout_date", { ascending: false });
      if (error) throw error;
      return (data as WorkoutSummary[]) ?? [];
    } catch (err) {
      console.error("Ошибка загрузки архива:", err);
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    loadArchive().then((data) => {
      if (cancelled) return;
      if (data) setArchive(data);
    });
    return () => {
      cancelled = true;
    };
  }, [loadArchive, user]);

  const addExercise = () => {
    setExercises((prev) => [...prev, { id: crypto.randomUUID(), name: "", sets: [emptyDraftSet()] }]);
  };
  const removeExercise = (id: string) => setExercises((prev) => prev.filter((e) => e.id !== id));
  const updateName = (id: string, name: string) =>
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));

  const addSet = (id: string) =>
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, sets: [...e.sets, emptyDraftSet()] } : e)));
  const removeSet = (id: string, i: number) =>
    setExercises((prev) =>
      prev.map((e) => (e.id === id && e.sets.length > 1 ? { ...e, sets: e.sets.filter((_, idx) => idx !== i) } : e))
    );
  const updateSet = (id: string, i: number, field: "reps" | "weight", value: string) =>
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, sets: e.sets.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) } : e))
    );

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
      const { data: wRow, error: wErr } = await withRetry(() =>
        supabase
          .from("workouts")
          .insert({
            client_id: user.id,
            creator_id: user.id,
            title: workoutTitle.trim(),
            workout_date: selectedDate,
          })
          .select("id")
          .single()
      );
      if (wErr) throw wErr;
      const newId: string = wRow.id;

      const rows = exercises
        .filter((e) => e.name.trim())
        .map((e) => ({
          workout_id: newId,
          name: e.name.trim(),
          ...buildSetsPayload(e.sets),
        }));

      if (rows.length > 0) {
        const { error: exErr } = await withRetry(() => supabase.from("exercises").insert(rows));
        if (exErr) throw exErr;
      }

      toast.success("Тренировка сохранена");
      setExercises([]);
      setWorkoutTitle("Моя силовая тренировка");
      const fresh = await loadArchive();
      if (fresh) setArchive(fresh);
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
      {/* Архив тренировок */}
      {archive.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">
            Архив тренировок ({archive.length})
          </h2>
          {archive.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => router.push(`/client/workouts/${w.id}`)}
              className="w-full flex items-center justify-between rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 text-left hover:border-[#262626] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{w.title}</p>
                <p className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider mt-0.5">{w.workout_date}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#989AA0] shrink-0" />
            </button>
          ))}
        </div>
      )}

      <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Конструктор тренировки</h2>

      {/* Дата */}
      <Card className="p-4 border border-[#1C1C1E] space-y-3 rounded-2xl">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-[#00E676]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-white">Дата</span>
        </div>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-xs font-mono" />
      </Card>

      {/* Конструктор */}
      <Card className="p-4 border border-[#1C1C1E] space-y-4 rounded-2xl">
        <div>
          <label className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider block mb-1.5">
            Название тренировки
          </label>
          <Input value={workoutTitle} onChange={(e) => setWorkoutTitle(e.target.value)} placeholder="Например: Силовая А, Ноги..." />
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
                      onChange={(e) => updateName(ex.id, e.target.value)}
                      className="h-8 !text-xs font-bold bg-transparent border-none p-0 focus:ring-0"
                    />
                  </div>
                  <Button variant="danger" onClick={() => removeExercise(ex.id)} className="h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <SetsEditor
                  sets={ex.sets}
                  onAdd={() => addSet(ex.id)}
                  onRemove={(i) => removeSet(ex.id, i)}
                  onChange={(i, field, value) => updateSet(ex.id, i, field, value)}
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
