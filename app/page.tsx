"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
const supabase = getSupabaseClient();
import { workoutService } from "@/services/workout.service";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { 
  MessageCircle, 
  FolderClock, 
  LogOut, 
  Dumbbell, 
  CheckCircle2, 
  Activity,
  ClipboardList,
  UserPlus,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

interface ClientProfile {
  id: string;
  full_name: string | null;
}

interface WorkoutSet {
  id: string;
  exercise_name: string;
  set_number: number;
  reps: string;
  weight: string;
  completed?: boolean;
}

interface TodayWorkout {
  id: string;
  name: string;
  status: string;
  is_custom: boolean;
  workout_sets: WorkoutSet[];
  notes?: string | null;
}

function getGeneratedWeek(baseDate: Date) {
  const dayOfWeek = baseDate.getDay();
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + distanceToMonday);
  const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  
  return names.map((name, index) => {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + index);
    return { name, date: nextDay.getDate(), fullDate: nextDay };
  });
}

function getMonthYearLabel(baseDate: Date) {
  return baseDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    .replace(" г.", "").replace(/^./, str => str.toUpperCase());
}

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  const [workoutsList, setWorkoutsList] = useState<TodayWorkout[]>([]);
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(true);
  const [comment, setComment] = useState("");
  const [isFinishing, setIsFinishing] = useState<string | null>(null);

  const hasFetchedClients = useRef(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const daysOfWeek = getGeneratedWeek(currentDate);

  const fetchClients = async () => {
    if (!user || hasFetchedClients.current) return;
    hasFetchedClients.current = true;
    try {
      setIsLoadingClients(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "client")
        .eq("trainer_id", user.id);
      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      toast.error(`Ошибка: ${err.message}`);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const fetchTodayWorkouts = async () => {
    if (!user) return;
    try {
      setIsLoadingWorkout(true);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDay).padStart(2, '0');
      const targetDateStr = `${year}-${month}-${day}`;

      const { data, error } = await supabase
        .from("workouts")
        .select(`
          id, name, status, is_custom, trainer_id, notes,
          workout_sets (id, exercise_name, set_number, reps, weight)
        `)
        .eq("client_id", user.id)
        .eq("date", targetDateStr);

      if (error) throw error;

      const formatted = (data || []).map((w: any) => ({
        id: w.id,
        name: w.name || "Силовая тренировка",
        status: w.status || "active",
        is_custom: !!w.is_custom,
        notes: w.notes,
        workout_sets: (w.workout_sets || []).map((s: any) => ({
          id: String(s.id),
          exercise_name: s.exercise_name,
          set_number: s.set_number,
          reps: String(s.reps),
          weight: String(s.weight),
          completed: false
        })).sort((a: any, b: any) => a.set_number - b.set_number)
      }));
      setWorkoutsList(formatted);
    } catch (err: any) {
      console.error(err);
      toast.error("Ошибка обновления ленты");
    } finally {
      setIsLoadingWorkout(false);
    }
  };

  const handleFinishWorkout = async (workout: TodayWorkout) => {
    setIsFinishing(workout.id);
    const loadingToast = toast.loading("Отправка...");
    try {
      const { error } = await supabase
        .from("workouts")
        .update({ status: "completed", notes: comment.trim() || null })
        .eq("id", workout.id);
      if (error) throw error;
      
      toast.success("Готово!", { id: loadingToast });
      setWorkoutsList(prev => prev.map(w => w.id === workout.id ? { ...w, status: "completed", notes: comment } : w));
      setComment("");
    } catch (err: any) {
      toast.error(`Ошибка: ${err.message}`, { id: loadingToast });
    } finally {
      setIsFinishing(null);
    }
  };

  // ... (остальные хелперы handleSignOut, toggleSetComplete и т.д. остаются без изменений)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* ... header ... */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        {workoutsList.map((workout) => (
          <div key={workout.id} className="border border-zinc-900 p-6 rounded-3xl bg-zinc-900/10">
            {workout.status === "completed" ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-2">
                <p className="text-xs font-bold text-emerald-400 uppercase">Ваш отчет:</p>
                <p className="text-sm text-zinc-300">{workout.notes || "Тренировка выполнена."}</p>
              </div>
            ) : (
              <>
                <textarea 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  placeholder="Заметка для тренера..." 
                  className="w-full h-16 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-white" 
                />
                <button 
                  onClick={() => handleFinishWorkout(workout)} 
                  disabled={isFinishing === workout.id}
                  className="w-full mt-4 bg-emerald-500 text-zinc-950 font-bold py-3 rounded-xl"
                >
                  Завершить тренировку
                </button>
              </>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}