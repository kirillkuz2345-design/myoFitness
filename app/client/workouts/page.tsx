"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { workoutService } from "@/services/workout.service";
import { syncService } from "@/services/sync.service";
import { type Workout, type WorkoutBlock } from "@/db/types";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Save, 
  CalendarDays, 
  ClipboardEdit
} from "lucide-react";

export default function ClientWorkoutConstructor() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [workoutTitle, setWorkoutTitle] = useState("Моя самостоятельная тренировка");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadCustomPlan() {
      setIsFetching(true);
      try {
        const data = await workoutService.getWorkoutWithBlocks(user!.id, selectedDate);
        if (data && data.workout) {
          setCurrentWorkoutId(data.workout.id);
          setWorkoutTitle(data.workout.title || "Самостоятельная тренировка");
          setBlocks(data.blocks || []);
        } else {
          setCurrentWorkoutId(null);
          setWorkoutTitle("Моя самостоятельная тренировка");
          setBlocks([]);
        }
      } catch (err) {
        toast.error("Не удалось загрузить план");
      } finally {
        setIsFetching(false);
      }
    }
    loadCustomPlan();
  }, [selectedDate, user]);

  const addBlock = () => {
    const activeWorkoutId = currentWorkoutId || crypto.randomUUID();
    if (!currentWorkoutId) setCurrentWorkoutId(activeWorkoutId);
    
    setBlocks([...blocks, {
      id: crypto.randomUUID(),
      workout_id: activeWorkoutId,
      name: "",
      order: blocks.length,
      exercises: [{
        id: crypto.randomUUID(),
        name: "",
        sets: 3,
        reps: 10,
        weight_kg: 0,
        duration_sec: null,
        notes: null
      }],
      sync_status: "pending"
    }]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id).map((b, idx) => ({ ...b, order: idx })));
  };

  const updateBlockName = (id: string, name: string) => {
    setBlocks(blocks.map((b) => b.id === id ? { ...b, name, exercises: b.exercises.map(ex => ({...ex, name})) } : b));
  };

  const updateExerciseField = (blockId: string, field: "sets" | "reps" | "weight_kg", value: string) => {
    setBlocks(blocks.map((b) => {
      if (b.id !== blockId) return b;
      const numValue = value === "" ? 0 : Number(value);
      return { ...b, exercises: b.exercises.map((ex, i) => i === 0 ? { ...ex, [field]: numValue } : ex) };
    }));
  };

  const handleSavePlan = async () => {
    if (blocks.length === 0) return toast.error("Добавьте упражнения!");
    if (blocks.some((b) => !b.name.trim())) return toast.error("Заполните названия!");

    setIsSaving(true);
    const loadingToast = toast.loading("Сохраняем...");

    try {
      const workoutId = currentWorkoutId || crypto.randomUUID();
      
      // ИСПРАВЛЕННЫЙ ОБЪЕКТ (Добавлены обязательные поля: name, status, is_custom)
      const workoutRecord: Workout = {
        id: workoutId,
        trainer_id: "", 
        client_id: user!.id,
        date: selectedDate,
        title: workoutTitle.trim(),
        name: workoutTitle.trim(),
        status: "active",
        is_custom: true,
        notes: null,
        sync_status: "pending"
      };

      const normalizedBlocks: WorkoutBlock[] = blocks.map((b, idx) => ({
        ...b,
        workout_id: workoutId,
        order: idx,
        sync_status: "pending"
      }));

      await workoutService.saveWorkoutWithBlocks(workoutRecord, normalizedBlocks);
      
      if (navigator.onLine) syncService.startSyncLoopIfNeeded().catch(() => {});
      
      setCurrentWorkoutId(workoutId);
      toast.success("Сохранено!", { id: loadingToast });
    } catch (err: any) {
      toast.error(`Ошибка: ${err.message}`, { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans antialiased pb-32">
       {/* Твоя верстка */}
    </div>
  );
}