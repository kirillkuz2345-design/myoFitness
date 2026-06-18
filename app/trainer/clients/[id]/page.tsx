"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Activity } from "lucide-react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { ensureDbReady } from "@/db/dexie";
import { WorkoutBlock, Workout, WorkoutRoutine } from "@/db/types";
import { useAuth } from "@/providers/AuthProvider";
import { routineRepository } from "@/services/routine.repository";

export default function TrainerClientWorkoutConfig() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const clientId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [workoutTitle, setWorkoutTitle] = useState("ПЛАН ТРЕНИРОВКИ");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  
  // ФИКС КАСКАДНОГО RENDER: Используем ленивую инициализацию стейта вместо useEffect
  const [activeWorkoutId, setActiveWorkoutId] = useState<string>(() => crypto.randomUUID());

  useEffect(() => {
    if (!clientId) return;

    async function fetchClientPlan() {
      try {
        const db = await ensureDbReady();
        const workout = await db.workouts.where({ client_id: clientId, date: selectedDate }).first();
        
        if (workout) {
          setActiveWorkoutId(workout.id);
          setWorkoutTitle(workout.title || workout.name || "ПЛАН ТРЕНИРОВКИ");
          const relatedBlocks = await db.workout_blocks.where("workout_id").equals(workout.id).toArray();
          setBlocks(relatedBlocks.sort((a, b) => a.order - b.order));
        } else {
          setBlocks([]);
        }
      } catch (err) {
        console.error("Ошибка чтения БД:", err);
        toast.error("ОШИБКА ЧТЕНИЯ БД");
      } finally {
        setIsLoading(false);
      }
    }

    fetchClientPlan();
  }, [clientId, selectedDate]);

  const addBlock = () => {
    const newBlock: WorkoutBlock = {
      id: crypto.randomUUID(),
      workout_id: activeWorkoutId,
      name: "",
      order: blocks.length,
      exercises: [{
        id: crypto.randomUUID(),
        setNumber: 1,
        sets: 1,
        reps: 10,
        weight: 0,
        weight_kg: 0,
        isBodyweight: false
      }]
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id).map((b, idx) => ({ ...b, order: idx })));
  };

  const updateBlockName = (id: string, name: string) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, name } : b)));
  };

  const updateExerciseField = (blockId: string, field: "sets" | "reps" | "weight_kg", value: string) => {
    const cleanValue = value === "" ? 0 : Number(value);
    setBlocks((prevBlocks) =>
      prevBlocks.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex, i) => {
            if (i === 0) {
              if (field === "weight_kg") return { ...ex, weight_kg: cleanValue, weight: cleanValue };
              if (field === "sets") return { ...ex, sets: cleanValue, setNumber: cleanValue };
              return { ...ex, [field]: cleanValue };
            }
            return ex;
          })
        };
      })
    );
  };

  const handleSavePlan = async () => {
    if (blocks.length === 0) return toast.error("ДОБАВЬТЕ УПРАЖНЕНИЯ!");
    if (!user?.id) return toast.error("НЕТ АВТОРИЗАЦИИ ТРЕНЕРА");

    const loadingToast = toast.loading("СОХРАНЕНИЕ...");
    try {
      const db = await ensureDbReady();
      const workoutRecord: Workout = {
        id: activeWorkoutId,
        trainer_id: user.id,
        client_id: clientId,
        date: selectedDate,
        title: workoutTitle.trim(),
        name: workoutTitle.trim(),
        status: "active",
        is_custom: false,
        notes: null,
        sync_status: "pending",
      };

      await db.transaction("rw", [db.workouts, db.workout_blocks], async () => {
        await db.workouts.put(workoutRecord);
        await db.workout_blocks.where("workout_id").equals(activeWorkoutId).delete();
        for (const block of blocks) {
          await db.workout_blocks.put(block);
        }
      });

      const routine: WorkoutRoutine = {
        id: activeWorkoutId,
        client_id: clientId,
        trainer_id: user.id,
        date: selectedDate,
        title: workoutTitle.trim(),
        blocks,
        recommendations: "",
        isPendingSync: false,
        status: "active",
        is_custom: false,
      };

      if (navigator.onLine) {
        await routineRepository.saveWorkoutRoutine(routine);
      }

      toast.success("ПЛАН НАЗНАЧЕН!", { id: loadingToast });
    } catch (err) {
      console.error("Ошибка при сохранении:", err);
      toast.error("ОШИБКА СОХРАНЕНИЯ", { id: loadingToast });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center space-y-4">
        <Activity className="h-8 w-8 text-[#00E676] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono p-4 md:p-8 pb-32">
      <Toaster />
      <header className="max-w-xl mx-auto flex items-center justify-between border-b border-[#262626] pb-6 mb-8">
        <button type="button" onClick={() => router.back()} className="text-[9px] uppercase tracking-widest text-[#989AA0] hover:text-white flex items-center gap-2">
          <ArrowLeft className="h-3.5 w-3.5" /> НАЗАД
        </button>
        <button type="button" onClick={handleSavePlan} className="bg-[#00E676] text-black px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">
          НАЗНАЧИТЬ ПЛАН
        </button>
      </header>

      <main className="max-w-xl mx-auto space-y-6">
        <div className="bg-[#141519] border border-[#262626] p-6 rounded-xl space-y-4">
          <input type="text" value={workoutTitle} onChange={(e) => setWorkoutTitle(e.target.value)} className="bg-transparent w-full font-black text-sm uppercase tracking-widest outline-none" />
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-3 text-[10px] w-full outline-none" />
        </div>

        <div className="space-y-3">
          {blocks.map((block, index) => (
            <motion.div key={block.id} className="bg-[#141519] border border-[#262626] p-5 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-[#00E676] bg-[#0A0A0A] w-6 h-6 rounded flex items-center justify-center">{index + 1}</span>
                <input type="text" value={block.name} onChange={(e) => updateBlockName(block.id, e.target.value)} placeholder="НАЗВАНИЕ УПРАЖНЕНИЯ" className="bg-transparent text-xs font-bold uppercase tracking-widest outline-none w-full" />
                <button type="button" onClick={() => removeBlock(block.id)} className="text-[#333] hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["sets", "reps", "weight_kg"] as const).map((field) => {
                  const val = block.exercises[0][field];
                  const displayValue = typeof val === 'number' ? val : "";
                  
                  return (
                    <div key={field} className="bg-[#0A0A0A] border border-[#262626] p-3 rounded-lg">
                      <label className="text-[7px] font-bold uppercase text-[#989AA0] block mb-1">{field === "weight_kg" ? "ВЕС (КГ)" : field}</label>
                      <input 
                        type="number" 
                        value={displayValue}
                        // ФИКС ТИПА ANY: Убрано приведение field as any
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExerciseField(block.id, field, e.target.value)} 
                        className="bg-transparent w-full text-xs font-mono outline-none" 
                      />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        <button type="button" onClick={addBlock} className="w-full py-4 border border-dashed border-[#262626] rounded-xl text-[9px] font-bold uppercase tracking-widest text-[#989AA0] hover:text-white transition-all">
          + ДОБАВИТЬ УПРАЖНЕНИЕ
        </button>
      </main>
    </div>
  );
}