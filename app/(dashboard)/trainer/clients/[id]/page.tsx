'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { ArrowLeft, Save, Plus, X, Trash2, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: number | null;
  client_note: string | null;
  trainer_comment: string | null;
}

interface Workout {
  id: string;
  title: string;
  workout_date: string;
  recommendation: string | null;
}

interface DraftExercise {
  tempId: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function TrainerClientView({ params }: Props) {
  const { id: clientId } = use(params);
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Конструктор новой тренировки
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cwTitle, setCwTitle] = useState('');
  const [cwDate, setCwDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cwRec, setCwRec] = useState('');
  const [cwExercises, setCwExercises] = useState<DraftExercise[]>([]);

  // Role-gate: только тренер может открывать разбор чужих тренировок.
  useEffect(() => {
    if (!authLoading && (!user || profile?.role?.toUpperCase() !== 'TRAINER')) {
      router.replace('/login');
    }
  }, [authLoading, user, profile, router]);

  // Загрузка тренировок: только возвращает данные (setState — в callback эффекта).
  const loadClientWorkouts = useCallback(async (): Promise<Workout[] | null> => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, title, workout_date, recommendation')
        .eq('client_id', clientId)
        .order('workout_date', { ascending: false });

      if (error) throw error;
      return (data as Workout[]) ?? [];
    } catch (err) {
      console.error('Ошибка загрузки тренировок:', err);
      return null;
    }
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    loadClientWorkouts().then((data) => {
      if (cancelled) return;
      if (data) {
        setWorkouts(data);
        setSelectedWorkout(data[0] ?? null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadClientWorkouts]);

  useEffect(() => {
    if (!selectedWorkout) return;

    const currentWorkoutId = selectedWorkout.id;
    let cancelled = false;

    // Канал создаём синхронно (до await), чтобы cleanup всегда его видел
    // и не было утечки/канала-сироты при быстрой смене тренировки.
    const channel: RealtimeChannel = supabase
      .channel(`trainer-workout-realtime-${currentWorkoutId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'exercises',
          filter: `workout_id=eq.${currentWorkoutId}`,
        },
        (payload: RealtimePostgresChangesPayload<Exercise>) => {
          setExercises((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Exercise;
              return prev.some((ex) => ex.id === row.id) ? prev : [...prev, row];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Exercise;
              return prev.map((ex) => (ex.id === row.id ? row : ex));
            }
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Partial<Exercise>;
              return prev.filter((ex) => ex.id !== oldRow.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    async function loadExercises() {
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .eq('workout_id', currentWorkoutId);

        if (error) throw error;
        if (!cancelled && data) setExercises(data);
      } catch (err) {
        console.error('Ошибка загрузки упражнений:', err);
      }
    }

    loadExercises();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedWorkout]);

  const handleSaveComment = async (exerciseId: string, comment: string) => {
    let previousComment: string | null = null;
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === exerciseId) {
          previousComment = ex.trainer_comment;
          return { ...ex, trainer_comment: comment };
        }
        return ex;
      })
    );

    const { error } = await supabase
      .from('exercises')
      .update({ trainer_comment: comment, updated_at: new Date().toISOString() })
      .eq('id', exerciseId);

    if (error) {
      console.error('Ошибка сохранения комментария:', error);
      toast.error('Не удалось сохранить комментарий');
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === exerciseId ? { ...ex, trainer_comment: previousComment } : ex
        )
      );
    }
  };

  // ── Конструктор новой тренировки ─────────────────────────────
  const addDraft = () => {
    setCwExercises((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), name: '', sets: '', reps: '', weight: '' },
    ]);
  };

  const removeDraft = (tempId: string) => {
    setCwExercises((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  const updateDraft = (tempId: string, field: keyof Omit<DraftExercise, 'tempId'>, value: string) => {
    setCwExercises((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d))
    );
  };

  const resetCreate = () => {
    setCwTitle('');
    setCwDate(new Date().toISOString().split('T')[0]);
    setCwRec('');
    setCwExercises([]);
  };

  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cwTitle.trim() || !cwDate) {
      toast.error('Укажите название и дату');
      return;
    }
    if (!user?.id) {
      toast.error('Сессия не найдена');
      return;
    }
    setSaving(true);
    try {
      // 1. Создаём тренировку (creator_id — тренер, NOT NULL в схеме)
      const { data: wRow, error: wErr } = await supabase
        .from('workouts')
        .insert({
          client_id: clientId,
          creator_id: user.id,
          title: cwTitle.trim(),
          workout_date: cwDate,
          recommendation: cwRec.trim() || null,
        })
        .select('id')
        .single();

      if (wErr) throw wErr;
      const newId: string = wRow.id;

      // 2. Создаём упражнения (только заполненные)
      const rows = cwExercises
        .filter((d) => d.name.trim())
        .map((d) => ({
          workout_id: newId,
          name: d.name.trim(),
          sets: Number(d.sets) || 0,
          reps: d.reps.trim(),
          weight: d.weight.trim() === '' ? null : Number(d.weight),
        }));

      if (rows.length > 0) {
        const { error: exErr } = await supabase.from('exercises').insert(rows);
        if (exErr) throw exErr;
      }

      // 3. Надёжный рефетч — тренировка не потеряется, даже если создана «в подвале»
      const fresh = await loadClientWorkouts();
      if (fresh) {
        setWorkouts(fresh);
        const created = fresh.find((w) => w.id === newId) ?? null;
        setSelectedWorkout(created);
      }

      toast.success('Тренировка создана');
      resetCreate();
      setShowCreate(false);
    } catch (err) {
      console.error('Ошибка создания тренировки:', err);
      toast.error('Не удалось создать тренировку');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-xs text-[#989AA0] py-16 uppercase tracking-widest animate-pulse">
        Синхронизация данных...
      </div>
    );
  }

  const inputCls =
    'w-full bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676] transition-colors';

  return (
    <div className="space-y-5 text-white">
      <div className="flex items-center justify-between">
        <Link
          href="/trainer/clients"
          className="text-xs text-[#989AA0] hover:text-[#00E676] flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> К списку атлетов
        </Link>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-[#00E676] text-black px-3 py-1.5 rounded-lg hover:bg-[#00c765] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Тренировка
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* История тренировок */}
        <div className="bg-[#111214] border border-[#1C1C1E] rounded-2xl p-4 space-y-2 h-fit">
          <h3 className="text-[10px] font-bold text-[#989AA0] uppercase tracking-wider mb-2">
            История тренировок
          </h3>
          {workouts.length > 0 ? (
            workouts.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkout(w)}
                className={`w-full text-left p-3 rounded-lg text-xs border transition-colors ${
                  selectedWorkout?.id === w.id
                    ? 'bg-[#0A0A0A] border-[#00E676]'
                    : 'bg-[#0A0A0A]/40 border-[#1C1C1E] text-[#989AA0] hover:border-zinc-700'
                }`}
              >
                <div className="font-bold text-gray-200">{w.title}</div>
                <div className="text-[10px] text-gray-500 mt-1">{w.workout_date}</div>
              </button>
            ))
          ) : (
            <div className="text-[11px] text-zinc-600 p-2 italic">Нет назначенных комплексов</div>
          )}
        </div>

        {/* Разбор упражнений */}
        <div className="md:col-span-2 bg-[#111214] border border-[#1C1C1E] rounded-2xl p-5 space-y-4">
          {selectedWorkout ? (
            <>
              <h2 className="text-xs font-bold text-[#00E676] uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-3 bg-[#00E676] rounded-full"></span>
                Комплекс: {selectedWorkout.title}
              </h2>

              {selectedWorkout.recommendation && (
                <div className="bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg p-3 text-[11px] text-gray-300">
                  <span className="text-[#989AA0] block mb-1 font-bold uppercase tracking-wider text-[9px]">
                    Рекомендации тренера:
                  </span>
                  {selectedWorkout.recommendation}
                </div>
              )}

              <div className="space-y-3">
                {exercises.length === 0 ? (
                  <div className="text-center text-[11px] text-zinc-600 py-6 border border-dashed border-[#1C1C1E] rounded-lg">
                    В этом комплексе пока нет упражнений
                  </div>
                ) : (
                  exercises.map((ex) => (
                    <div key={ex.id} className="p-4 bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg space-y-3">
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-bold text-zinc-200">{ex.name}</span>
                        <span className="text-gray-500 bg-[#111214] px-2 py-0.5 border border-zinc-800 rounded">
                          {ex.sets}x{ex.reps} {ex.weight ? `(${ex.weight} кг)` : ''}
                        </span>
                      </div>

                      <div className="bg-[#141414] p-2.5 border border-[#1C1C1E] rounded text-[11px] text-gray-400">
                        <span className="text-gray-500 block mb-1 font-bold">Обратная связь атлета:</span>
                        {ex.client_note ? (
                          <span className="text-zinc-300 italic">«{ex.client_note}»</span>
                        ) : (
                          <span className="text-zinc-600 italic">Заметок от атлета пока нет</span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500">Ваш разбор / Корректировка техники:</label>
                        <div className="flex gap-2">
                          <input
                            id={`trainer-comment-${ex.id}`}
                            type="text"
                            defaultValue={ex.trainer_comment || ''}
                            onBlur={(e) => handleSaveComment(ex.id, e.target.value)}
                            placeholder="Оставить отзыв или скорректировать технику..."
                            className="flex-1 bg-[#111214] border border-[#1C1C1E] rounded p-2 text-xs text-white focus:outline-none focus:border-[#00E676] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(
                                `trainer-comment-${ex.id}`
                              ) as HTMLInputElement | null;
                              handleSaveComment(ex.id, input?.value ?? '');
                            }}
                            className="p-2 bg-[#1C1C1E] rounded text-zinc-400 hover:text-white transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-xs text-gray-600 py-10 border border-dashed border-[#1C1C1E] rounded-xl flex flex-col items-center gap-2">
              <ClipboardList className="w-5 h-5 text-zinc-700" />
              Нет тренировок. Создайте первую кнопкой «Тренировка».
            </div>
          )}
        </div>
      </div>

      {/* Модалка: конструктор тренировки */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Новая тренировка</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  resetCreate();
                }}
                aria-label="Закрыть"
              >
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkout} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Название
                  </label>
                  <input
                    value={cwTitle}
                    onChange={(e) => setCwTitle(e.target.value)}
                    placeholder="Силовая А, Ноги…"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Дата
                  </label>
                  <input
                    type="date"
                    value={cwDate}
                    onChange={(e) => setCwDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                  Рекомендации тренера
                </label>
                <textarea
                  value={cwRec}
                  onChange={(e) => setCwRec(e.target.value)}
                  rows={2}
                  placeholder="Разминка, темп, что контролировать…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Упражнения */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Упражнения ({cwExercises.length})
                  </span>
                  <button
                    type="button"
                    onClick={addDraft}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>

                {cwExercises.map((d, idx) => (
                  <div key={d.tempId} className="bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-zinc-500">#{idx + 1}</span>
                      <input
                        value={d.name}
                        onChange={(e) => updateDraft(d.tempId, 'name', e.target.value)}
                        placeholder="Название упражнения"
                        className="flex-1 bg-transparent text-xs font-bold text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeDraft(d.tempId)}
                        aria-label="Удалить упражнение"
                        className="text-zinc-600 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={d.sets}
                        onChange={(e) => updateDraft(d.tempId, 'sets', e.target.value)}
                        inputMode="numeric"
                        placeholder="Подходы"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                      <input
                        value={d.reps}
                        onChange={(e) => updateDraft(d.tempId, 'reps', e.target.value)}
                        placeholder="Повторы"
                        className="bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-center text-white outline-none focus:border-[#00E676]"
                      />
                      <input
                        value={d.weight}
                        onChange={(e) => updateDraft(d.tempId, 'weight', e.target.value)}
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
                {saving ? 'Создание...' : 'Создать тренировку'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
