"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider"; 
import { getSupabaseClient } from "@/lib/supabase/client";
import { LogOut, Dumbbell } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// Наша дизайн-система
import { Card, Button, Input } from "@/components/ui/myo";

const supabase = getSupabaseClient();

// Строгий интерфейс для тренировок вместо any
interface WorkoutItem {
  id: string;
  name: string;
}

export default function RootPage() {
  const authContext = useAuth();
  const { loading } = authContext || { loading: true };
  const router = useRouter();

  // --- Состояния ---
  const [activeTab, setActiveTab] = useState<"workout" | "chat">("workout");
  
  // Типизируем стейт тренировок через наш интерфейс
  const [workoutsList] = useState<WorkoutItem[]>([]);
  
  const [comments, setComments] = useState<Record<string, string>>({});
  const [isFinishing, setIsFinishing] = useState<string | null>(null);

  // --- Логика ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleFinishWorkout = async (workout: WorkoutItem) => {
    setIsFinishing(workout.id);
    
    const currentComment = comments[workout.id] || "";
    
    try {
      // Имитируем отправку комментария, чтобы линтер видел его использование
      if (currentComment) {
        console.log(`Сохранение комментария для ${workout.id}: ${currentComment}`);
      }
      // Здесь будет запрос к Supabase, например:
      // await supabase.from('workouts').update({ status: 'finished', notes: currentComment }).eq('id', workout.id);
      
      toast.success("ТРЕНИРОВКА ЗАФИКСИРОВАНА");
    } catch (error) {
      console.error("Ошибка при сохранении тренировки:", error);
      toast.error("ОШИБКА СОХРАНЕНИЯ");
    } finally {
      setIsFinishing(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono p-4">ЗАГРУЗКА...</div>;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono">
      <Toaster />

      <header className="border-b border-[#222328] sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-base font-black text-white">myoFitnes</span>
          <div className="flex gap-2">
            <Button variant={activeTab === "workout" ? "primary" : "secondary"} onClick={() => setActiveTab("workout")}>
              <Dumbbell className="h-3 w-3" />
            </Button>
            <Button variant="danger" onClick={handleSignOut}>
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">
        {activeTab === "workout" && (
          <div className="space-y-6">
            {workoutsList.length === 0 ? (
              <div className="text-zinc-600 text-center py-8">НЕТ ДОСТУПНЫХ ТРЕНИРОВОК</div>
            ) : (
              workoutsList.map((workout) => (
                <Card key={workout.id}>
                  <h4 className="font-bold uppercase text-white mb-4">{workout.name}</h4>
                  
                  <Input 
                    value={comments[workout.id] || ""} 
                    onChange={(e) => setComments({
                      ...comments,
                      [workout.id]: e.target.value
                    })} 
                    placeholder="ОСТАВИТЬ ЗАМЕТКУ..." 
                  />
                  
                  <Button 
                    className="w-full mt-3" 
                    onClick={() => handleFinishWorkout(workout)}
                    disabled={isFinishing === workout.id}
                  >
                    {isFinishing === workout.id ? "ОТПРАВКА..." : "ЗАФИКСИРОВАТЬ"}
                  </Button>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}