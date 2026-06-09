"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
const supabase = getSupabaseClient();
import { motion } from "framer-motion";
import { ArrowLeft, FolderClock, Trophy, CalendarDays, Dumbbell } from "lucide-react";

interface CompletedWorkout {
  id: string;
  name: string;
  date: string;
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
    // Ждем, пока загрузится авторизация
    if (authLoading) return;

    // Если не авторизован - на выход
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("workouts")
          .select(`
            id,
            name,
            date,
            workout_sets ( exercise_name, reps, weight )
          `)
          .eq("client_id", user.id)
          .eq("status", "completed")
          .order("date", { ascending: false });

        if (error) throw error;
        setHistory((data || []) as unknown as CompletedWorkout[]);
      } catch (error) {
        console.error("Ошибка загрузки истории:", error);
      } finally {
        // ГАРАНТИРОВАННО выключаем спиннер загрузки при любом исходе
        setIsLoading(false); 
      }
    };

    // Запрашиваем историю только если это клиент
    if (profile?.role === "client") {
      fetchHistory();
    } else {
      // Если почему-то сюда зашел тренер, просто выключаем загрузку
      setIsLoading(false);
    }
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
      <header className="border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-4">
            <button 
              onClick={() => router.push("/")}
              className="p-2 -ml-2 text-zinc-400 hover:text-white transition rounded-xl hover:bg-zinc-800/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <FolderClock className="w-5 h-5 text-emerald-500" />
              <span className="text-lg font-semibold text-white tracking-wide">Архив тренировок</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        {history.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-dashed border-zinc-800 p-12 text-center flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
              <Dumbbell className="w-8 h-8" />
            </div>
            <p className="text-zinc-400 text-sm">Тут пока пусто. Заверши свою первую тренировку, чтобы она появилась в архиве.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {history.map((workout, idx) => {
              // Группируем сеты для красивого вывода
              const exercises = Array.from(new Set(workout.workout_sets.map(s => s.exercise_name)));
              
              return (
                <motion.div 
                  key={workout.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="rounded-3xl border border-zinc-900 bg-zinc-900/30 p-5 space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-emerald-400 mb-1">{workout.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {new Date(workout.date).toLocaleDateString('ru-RU', { 
                          day: 'numeric', month: 'long', year: 'numeric' 
                        })}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Trophy className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>

                  <div className="bg-zinc-950/50 rounded-2xl p-4 border border-zinc-900/50">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-3">Выполненные упражнения</p>
                    <ul className="space-y-2">
                      {exercises.map(ex => {
                        const sets = workout.workout_sets.filter(s => s.exercise_name === ex);
                        return (
                          <li key={ex} className="text-sm flex justify-between items-center text-zinc-300">
                            <span>{ex}</span>
                            <span className="text-xs text-zinc-500 font-mono bg-zinc-900 px-2 py-1 rounded-md">
                              {sets.length} подходов
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  );
}