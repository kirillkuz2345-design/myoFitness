'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

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
}

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default function TrainerClientView({ params }: Props) {
  const { id: clientId } = use(params);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadClientWorkouts() {
      try {
        const { data, error } = await supabase
          .from('workouts')
          .select('id, title, workout_date')
          .eq('client_id', clientId)
          .order('workout_date', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setWorkouts(data);
          setSelectedWorkout(data[0]);
        }
      } catch (err) {
        console.error('Ошибка загрузки тренировок:', err);
      } finally {
        setLoading(false);
      }
    }
    loadClientWorkouts();
  }, [clientId]);

  useEffect(() => {
    if (!selectedWorkout) return;

    let activeChannel: any = null;
    const currentWorkoutId = selectedWorkout.id; // Кэшируем ID, гарантируя безопасность для TypeScript

    async function loadExercises() {
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .eq('workout_id', currentWorkoutId);

        if (error) throw error;
        if (data) setExercises(data);

        // Real-time подписка
        activeChannel = supabase
          .channel(`trainer-workout-realtime-${currentWorkoutId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'exercises',
              filter: `workout_id=eq.${currentWorkoutId}`,
            },
            (payload: any) => {
              if (payload.new) {
                setExercises((prev) =>
                  prev.map((ex) => (ex.id === payload.new.id ? (payload.new as Exercise) : ex))
                );
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Ошибка загрузки упражнений:', err);
      }
    }

    loadExercises();

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [selectedWorkout]);

  const handleSaveComment = async (exerciseId: string, comment: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, trainer_comment: comment } : ex))
    );

    await supabase
      .from('exercises')
      .update({ trainer_comment: comment, updated_at: new Date().toISOString() })
      .eq('id', exerciseId);
  };

  if (loading) {
    return (
      <div className="text-center text-xs text-gray-500 py-10 font-mono bg-zinc-950 min-h-screen flex items-center justify-center">
        Синхронизация данных...
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 text-white font-mono space-y-6">
      <Link href="/trainer/clients" className="text-xs text-gray-400 hover:text-[#00F5D4] flex items-center gap-1 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Назад к списку атлетов
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* История тренировок */}
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 space-y-2 h-fit">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">История тренировок</h3>
          {workouts.length > 0 ? (
            workouts.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkout(w)}
                className={`w-full text-left p-3 rounded-lg text-xs border transition-colors ${
                  selectedWorkout?.id === w.id ? 'bg-[#0A0A0A] border-[#00F5D4]' : 'bg-[#0A0A0A]/40 border-[#262626] text-gray-400 hover:border-zinc-700'
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
        <div className="md:col-span-2 bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 space-y-4">
          {selectedWorkout ? (
            <>
              <h2 className="text-xs font-bold text-[#00F5D4] uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-3 bg-[#00F5D4] rounded-full"></span>
                Комплекс: {selectedWorkout.title}
              </h2>
              <div className="space-y-3">
                {exercises.map((ex) => (
                  <div key={ex.id} className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg space-y-3">
                    <div className="flex justify-between text-xs items-center">
                      <span className="font-bold text-zinc-200">{ex.name}</span>
                      <span className="text-gray-500 bg-[#1A1A1A] px-2 py-0.5 border border-zinc-800 rounded">
                        {ex.sets}x{ex.reps} {ex.weight ? `(${ex.weight} кг)` : ''}
                      </span>
                    </div>

                    <div className="bg-[#141414] p-2.5 border border-[#262626] rounded text-[11px] text-gray-400">
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
                          className="flex-1 bg-[#1A1A1A] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none focus:border-[#00F5D4] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(
                              `trainer-comment-${ex.id}`
                            ) as HTMLInputElement | null;
                            handleSaveComment(ex.id, input?.value ?? '');
                          }}
                          className="p-2 bg-[#262626] rounded text-zinc-400 hover:text-white transition-colors"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-xs text-gray-600 py-10 border border-dashed border-[#262626] rounded-xl">
              Нет выбранной тренировки.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}