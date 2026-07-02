// app/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
const supabase = getSupabaseClient();
import { motion } from "framer-motion";
import { ArrowLeft, FolderClock, Trophy, CalendarDays, Dumbbell, User, MessageSquare } from "lucide-react";

interface CompletedWorkout {
  id: string;
  name: string;
  date: string;
  notes?: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
  workout_sets: {
    exercise_name: string;
    reps: string;
    weight: string;
  }[];
}

export default function HistoryPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const fetchHistory = async () => {
      try {
        let query = supabase
          .from("workouts")
          .select(`
            id,
            name,
            date,
            notes,
            profiles:client_id ( full_name ),
            workout_sets ( exercise_name, reps, weight )
          `)
          .eq("status", "completed")
          .order("date", { ascending: false });

        if (profile?.role === "client") {
          query = query.eq("client_id", user.id);
        } else if (profile?.role === "trainer") {
          query = query.eq("trainer_id", user.id);
        } else {
          setIsLoading(false);
          return;
        }

        const { data, error } = await query;

        if (error) throw error;
        setHistory((data || []) as unknown as CompletedWorkout[]);
      } catch (error) {
        console.error("Ошибка загрузки истории тренировок:", error);
      } finally {
        setIsLoading(false); 
      }
    };

    fetchHistory();
  }, [user, profile, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-900 border-t-emerald-500"></div>
          <p className="text-sm font-sans font-medium text-zinc-500 tracking-wider">Загрузка архива...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans antialiased">
      {/* ШАПКА АРХИВА */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-4">
        <div className="mx-auto max-w-xl flex h-16 items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="p-2 -ml-2 text-zinc-400 hover:text-white transition rounded-xl hover:bg-zinc-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <FolderClock className="w-5 h-5 text-emerald-500" />
            <span className="text-base font-bold text-white tracking-wide">Архив тренировок</span>
          </div>
        </div>
      </header>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="mx-auto max-w-xl px-4 py-6 space-y-6">
        {history.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10 p-12 text-center flex flex-col items-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Архив пуст</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                {profile?.role === "trainer" 
                  ? "Подопечные пока не завершили ни одной тренировки из плана." 
                  : "Завершите свою первую тренировку на главном экране, чтобы она появилась здесь."}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {history.map((workout, idx) => {
              // Исправлено: чистим пробелы для корректной группировки
              const exercises = Array.from(
                new Set(workout.workout_sets.map(s => s.exercise_name?.trim()).filter(Boolean))
              );
              
              return (
                <motion.div 
                  key={workout.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                  className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-5 space-y-4"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      {profile?.role === "trainer" && workout.profiles?.full_name && (
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-md w-fit mb-1 truncate">
                          <User className="w-2.5 h-2.5" />
                          <span>{workout.profiles.full_name}</span>
                        </div>
                      )}
                      <h3 className="text-sm font-bold text-zinc-100 truncate">{workout.name}</h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {new Date(workout.date).toLocaleDateString('ru-RU', { 
                          day: 'numeric', month: 'long', year: 'numeric' 
                        })}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
                      <Trophy className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>

                  {/* Список упражнений и подходов */}
                  <div className="bg-zinc-950/60 rounded-xl p-4 border border-zinc-900/60 space-y-2.5">
                    {exercises.map(ex => {
                      // Исправлено: фильтруем с .trim() для исключения 0 подходов
                      const sets = workout.workout_sets.filter(s => s.exercise_name?.trim() === ex);
                      const setsCount = sets.length > 0 ? sets.length : 1;

                      return (
                        <div key={ex} className="text-xs flex justify-between items-center text-zinc-300 gap-4">
                          <span className="font-medium truncate">{ex}</span>
                          <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-900">
                            {setsCount} подх.
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {workout.notes && (
                    <div className="flex gap-2 rounded-xl bg-zinc-950 border border-zinc-900 p-3 text-xs text-zinc-400">
                      <MessageSquare className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Отчет:</p>
                        <p className="leading-relaxed italic">«{workout.notes}»</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  );
}