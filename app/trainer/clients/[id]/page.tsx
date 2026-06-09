"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { workoutService } from "@/services/workout.service";
import { type WorkoutBlock } from "@/db/types";
import { syncService } from "@/services/sync.service";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, Trash2, Plus, Save, CalendarDays, ClipboardEdit, Link2, MessageSquareText } from "lucide-react";

export default function TrainerClientPlanner() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  
  const clientId = params?.id as string;

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [workoutTitle, setWorkoutTitle] = useState("Силовая тренировка");
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !clientId) return;

    async function loadPlan() {
      setIsFetching(true);
      try {
        const data = await workoutService.getWorkoutWithBlocks(clientId, selectedDate);
        if (data) {
          setCurrentWorkoutId(data.workout.id);
          setWorkoutTitle(data.workout.title || "Силовая тренировка");
          setNotes(data.workout.notes || "");
          setBlocks(data.blocks || []);
        } else {
          setCurrentWorkoutId(null);
          setWorkoutTitle("Новая тренировка");
          setNotes("");
          setBlocks([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsFetching(false);
      }
    }
    loadPlan();
  }, [clientId, selectedDate, user]);

  const addBlock = () => {
    const activeWorkoutId = currentWorkoutId || crypto.randomUUID();
    if (!currentWorkoutId) setCurrentWorkoutId(activeWorkoutId);

    const newBlock: WorkoutBlock = {
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
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id).map((b, idx) => ({ ...b, order: idx })));
  };

  const updateBlockName = (id: string, name: string) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, name: name } : b)));
  };

  const updateExerciseField = (blockId: string, field: string, value: string) => {
    setBlocks(blocks.map((b) => {
      if (b.id !== blockId) return b;
      const updatedExercises = b.exercises.map((ex) => {
        if (field === "name") return { ...ex, name: value };
        return { ...ex, [field]: value === "" ? 0 : Number(value) };
      });
      return { ...b, exercises: updatedExercises };
    }));
  };

  const handleSavePlan = async () => {
    if (blocks.length === 0) return toast.error("Добавьте упражнения!");
    setIsSaving(true);
    const loadingToast = toast.loading("Сохранение...");
    try {
      const workoutId = currentWorkoutId || crypto.randomUUID();
      const workoutRecord: any = {
        id: workoutId,
        trainer_id: user!.id,
        client_id: clientId,
        date: selectedDate,
        title: workoutTitle,
        name: workoutTitle,
        status: "active",
        notes: notes.trim() || null,
        is_custom: false 
      };

      await workoutService.saveWorkoutWithBlocks(workoutRecord, blocks as any);
      toast.success("Сохранено!", { id: loadingToast });
    } catch (err: any) {
      toast.error(`Ошибка: ${err.message}`, { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;
  if (profile?.role !== "trainer") return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans pb-32">
      <header className="border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="text-zinc-400 hover:text-white transition text-sm flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> К списку
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <section className="space-y-4 bg-zinc-900/10 p-6 rounded-3xl border border-zinc-900">
          <div className="grid sm:grid-cols-2 gap-4">
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl px-4 py-3.5 text-sm text-white" />
            <input type="text" value={workoutTitle} onChange={(e) => setWorkoutTitle(e.target.value)} className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl px-4 py-3.5 text-sm text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider flex items-center gap-1.5">
              <MessageSquareText className="w-3.5 h-3.5" /> Заметки для клиента
            </label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl px-4 py-3 text-sm text-white min-h-[100px]" 
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold tracking-tight">Упражнения</h2>
            <button onClick={addBlock} className="bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {blocks.map((block) => (
                <motion.div key={block.id} className="grid grid-cols-12 gap-2 bg-zinc-900/20 p-3 rounded-2xl border border-zinc-900 items-center">
                  <div className="col-span-12 sm:col-span-4">
                    <input type="text" value={block.name} onChange={(e) => updateBlockName(block.id, e.target.value)} className="w-full bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm rounded-xl" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" value={block.exercises?.[0]?.sets ?? ""} onChange={(e) => updateExerciseField(block.id, "sets", e.target.value)} className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-2 text-center text-sm" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" value={block.exercises?.[0]?.reps ?? ""} onChange={(e) => updateExerciseField(block.id, "reps", e.target.value)} className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-2 text-center text-sm" />
                  </div>
                  <div className="col-span-3 sm:col-span-3">
                    <input type="number" value={block.exercises?.[0]?.weight_kg ?? ""} onChange={(e) => updateExerciseField(block.id, "weight_kg", e.target.value)} className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-2 text-center text-sm text-emerald-400" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeBlock(block.id)} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 z-40">
          <button onClick={handleSavePlan} disabled={isSaving} className="mx-auto w-full max-w-4xl bg-emerald-500 text-zinc-950 font-bold py-4 rounded-2xl">
            {isSaving ? "Сохранение..." : "СОХРАНИТЬ ПЛАН"}
          </button>
        </div>
      </main>
    </div>
  );
}