// app/(dashboard)/trainer/calendar/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { withRetry } from "@/lib/dbRetry";
import { safeUUID } from "@/lib/uuid";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Copy, X, Plus, Trash2 } from "lucide-react";

interface ClientOption {
  id: string;
  full_name: string | null;
}

interface Workout {
  id: string;
  title: string;
  workout_date: string; // YYYY-MM-DD
  recommendation: string | null;
}

interface DraftExercise {
  tempId: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  trainerComment: string;
  clientNote: string;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TrainerCalendarPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [monthDate, setMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Копирование
  const [copyOpen, setCopyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cpTitle, setCpTitle] = useState("");
  const [cpDate, setCpDate] = useState(() => ymd(new Date()));
  const [cpRec, setCpRec] = useState("");
  const [cpExercises, setCpExercises] = useState<DraftExercise[]>([]);

  // Role-gate: не выкидываем, пока профиль ещё грузится (иначе F5 сбрасывает на /login)
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    if (!authLoading && profile && profile.role?.toUpperCase() !== "TRAINER") {
      router.replace("/login");
    }
  }, [authLoading, user, profile, router]);

  // Список атлетов
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "client")
      .eq("trainer_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Ошибка загрузки атлетов:", error);
          return;
        }
        const list = (data as ClientOption[]) ?? [];
        setClients(list);
        setSelectedClientId((prev) => prev || list[0]?.id || "");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const monthStart = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    [monthDate]
  );
  const monthEnd = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0),
    [monthDate]
  );

  // Тренировки выбранного атлета за месяц
  const loadWorkouts = useCallback(async (): Promise<Workout[] | null> => {
    if (!selectedClientId) return [];
    try {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, title, workout_date, recommendation")
        .eq("client_id", selectedClientId)
        .gte("workout_date", ymd(monthStart))
        .lte("workout_date", ymd(monthEnd))
        .order("workout_date", { ascending: true });
      if (error) throw error;
      return (data as Workout[]) ?? [];
    } catch (err) {
      console.error("Ошибка загрузки тренировок:", err);
      return null;
    }
  }, [selectedClientId, monthStart, monthEnd]);

  useEffect(() => {
    let cancelled = false;
    // setState только в callback — требование react-hooks/set-state-in-effect.
    loadWorkouts().then((data) => {
      if (cancelled) return;
      setWorkouts(data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [loadWorkouts]);

  // Сетка месяца
  const cells = useMemo(() => {
    const firstWeekday = (monthStart.getDay() + 6) % 7; // Пн=0
    const daysInMonth = monthEnd.getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
    }
    return arr;
  }, [monthStart, monthEnd, monthDate]);

  const workoutsByDay = useMemo(() => {
    const map: Record<string, Workout[]> = {};
    for (const w of workouts) {
      (map[w.workout_date] ??= []).push(w);
    }
    return map;
  }, [workouts]);

  const dayWorkouts = selectedDay ? workoutsByDay[selectedDay] ?? [] : [];
  const todayStr = ymd(new Date());

  const shiftMonth = (delta: number) => {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDay(null);
  };

  // ── Копирование тренировки ───────────────────────────────────
  const openCopy = async (w: Workout) => {
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("name, sets, reps, weight, trainer_comment, client_note")
        .eq("workout_id", w.id);
      if (error) throw error;
      const drafts: DraftExercise[] = (data ?? []).map((ex) => ({
        tempId: safeUUID(),
        name: ex.name ?? "",
        sets: ex.sets != null ? String(ex.sets) : "",
        reps: ex.reps ?? "",
        weight: ex.weight != null ? String(ex.weight) : "",
        trainerComment: ex.trainer_comment ?? "",
        clientNote: ex.client_note ?? "",
      }));
      setCpTitle(`${w.title} (копия)`);
      setCpDate(ymd(new Date()));
      setCpRec(w.recommendation ?? "");
      setCpExercises(drafts);
      setCopyOpen(true);
    } catch (err) {
      console.error("Ошибка чтения упражнений:", err);
      toast.error("Не удалось прочитать тренировку");
    }
  };

  const updateDraft = (tempId: string, field: keyof Omit<DraftExercise, "tempId">, value: string) => {
    setCpExercises((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d)));
  };
  const addDraft = () => {
    setCpExercises((prev) => [
      ...prev,
      { tempId: safeUUID(), name: "", sets: "", reps: "", weight: "", trainerComment: "", clientNote: "" },
    ]);
  };
  const removeDraft = (tempId: string) => {
    setCpExercises((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  const saveCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpTitle.trim() || !cpDate) {
      toast.error("Укажите название и дату");
      return;
    }
    if (!user?.id || !selectedClientId) {
      toast.error("Не выбран атлет");
      return;
    }
    setSaving(true);
    try {
      const { data: wRow, error: wErr } = await withRetry(() =>
        supabase
          .from("workouts")
          .insert({
            client_id: selectedClientId,
            creator_id: user.id,
            title: cpTitle.trim(),
            workout_date: cpDate,
            recommendation: cpRec.trim() || null,
          })
          .select("id")
          .single()
      );
      if (wErr) throw wErr;
      const newId: string = wRow.id;

      const rows = cpExercises
        .filter((d) => d.name.trim())
        .map((d) => ({
          workout_id: newId,
          name: d.name.trim(),
          sets: Number(d.sets) || 0,
          reps: d.reps.trim(),
          weight: d.weight.trim() === "" ? null : Number(d.weight),
          trainer_comment: d.trainerComment.trim() || null,
          client_note: d.clientNote.trim() || null,
        }));
      if (rows.length > 0) {
        const { error: exErr } = await withRetry(() => supabase.from("exercises").insert(rows));
        if (exErr) throw exErr;
      }

      const fresh = await loadWorkouts();
      if (fresh) setWorkouts(fresh);
      // если скопировали в текущий месяц — подсветим день
      const d = new Date(cpDate);
      if (d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()) {
        setSelectedDay(cpDate);
      }
      toast.success("Тренировка скопирована");
      setCopyOpen(false);
    } catch (err) {
      console.error("Ошибка копирования:", err);
      toast.error("Не удалось скопировать");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676] transition-colors";

  return (
    <div className="space-y-4">
      {/* Выбор атлета */}
      <div className="space-y-1.5">
        <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Атлет</label>
        <select
          value={selectedClientId}
          onChange={(e) => {
            setSelectedClientId(e.target.value);
            setSelectedDay(null);
          }}
          className={inputCls}
        >
          {clients.length === 0 && <option value="">Нет привязанных атлетов</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || "Атлет без имени"}
            </option>
          ))}
        </select>
      </div>

      {/* Навигация по месяцу */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#1C1C1E] text-[#989AA0] hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-white">
          {MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#1C1C1E] text-[#989AA0] hover:text-white"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Сетка */}
      <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[8px] font-bold uppercase text-[#989AA0] py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const key = ymd(d);
            const has = (workoutsByDay[key]?.length ?? 0) > 0;
            const isToday = key === todayStr;
            const isSel = key === selectedDay;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                className={`aspect-square rounded-lg text-[11px] flex flex-col items-center justify-center gap-0.5 border transition-colors ${
                  isSel
                    ? "border-[#00E676] bg-[#0A0A0A]"
                    : isToday
                      ? "border-[#00E676]/40 bg-[#0A0A0A]/50"
                      : "border-transparent hover:border-[#1C1C1E]"
                }`}
              >
                <span className={has ? "text-white font-bold" : "text-[#989AA0]"}>{d.getDate()}</span>
                {has && <span className="w-1 h-1 rounded-full bg-[#00E676]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Тренировки выбранного дня */}
      {selectedDay && (
        <div className="space-y-2">
          <h3 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">
            {selectedDay}
          </h3>
          {dayWorkouts.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#1C1C1E] rounded-xl text-[10px] text-zinc-600 uppercase">
              Нет тренировок в этот день
            </div>
          ) : (
            dayWorkouts.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-[#1C1C1E] bg-[#111214] p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{w.title}</p>
                  {w.recommendation && (
                    <p className="text-[9px] text-[#989AA0] truncate mt-0.5">{w.recommendation}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openCopy(w)}
                  className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
                >
                  <Copy className="w-3.5 h-3.5" /> Копировать
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Модалка копирования / правки */}
      {copyOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Копия тренировки</h3>
              <button type="button" onClick={() => setCopyOpen(false)} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>

            <form onSubmit={saveCopy} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Название
                  </label>
                  <input value={cpTitle} onChange={(e) => setCpTitle(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Новая дата
                  </label>
                  <input type="date" value={cpDate} onChange={(e) => setCpDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                  Рекомендации тренера
                </label>
                <textarea
                  value={cpRec}
                  onChange={(e) => setCpRec(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Упражнения ({cpExercises.length})
                  </span>
                  <button
                    type="button"
                    onClick={addDraft}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>

                {cpExercises.map((d, idx) => (
                  <div key={d.tempId} className="bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-zinc-500">#{idx + 1}</span>
                      <input
                        value={d.name}
                        onChange={(e) => updateDraft(d.tempId, "name", e.target.value)}
                        placeholder="Название упражнения"
                        className="flex-1 bg-transparent text-xs font-bold text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeDraft(d.tempId)}
                        aria-label="Удалить"
                        className="text-zinc-600 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={d.sets}
                        onChange={(e) => updateDraft(d.tempId, "sets", e.target.value)}
                        inputMode="numeric"
                        placeholder="Подходы"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                      <input
                        value={d.reps}
                        onChange={(e) => updateDraft(d.tempId, "reps", e.target.value)}
                        placeholder="Повторы"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                      <input
                        value={d.weight}
                        onChange={(e) => updateDraft(d.tempId, "weight", e.target.value)}
                        inputMode="decimal"
                        placeholder="Вес, кг"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                    </div>
                    <input
                      value={d.trainerComment}
                      onChange={(e) => updateDraft(d.tempId, "trainerComment", e.target.value)}
                      placeholder="Комментарий тренера"
                      className="w-full bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#00E676]"
                    />
                    <input
                      value={d.clientNote}
                      onChange={(e) => updateDraft(d.tempId, "clientNote", e.target.value)}
                      placeholder="Комментарий подопечного"
                      className="w-full bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#00E676]"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#00E676] text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {saving ? "Сохранение..." : "Создать копию"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
