"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Dumbbell, Eye, Save } from "lucide-react";
import { Card, Button, Input } from "@/components/ui/myo";
import { WorkoutRoutine, WorkoutBlock } from "@/db/types";
import { stampRoutine } from "@/lib/routines/conflict";
import WorkoutBlockCard, { type UIWorkoutBlock } from "./WorkoutBlockCard";

const COMPACT_BLOCK_THRESHOLD = 20;

interface PremiumWorkoutBuilderProps {
  mode?: "edit" | "create" | "client-log" | string;
  initialData?: WorkoutRoutine | null;
  clientId?: string;
  trainerId?: string | null;
  onSave?: (updatedRoutine: WorkoutRoutine) => void;
}

export default function PremiumWorkoutBuilder({
  mode = "create",
  initialData = null,
  clientId = "",
  trainerId = null,
  onSave,
}: PremiumWorkoutBuilderProps) {
  const [workoutTitle, setWorkoutTitle] = useState(
    initialData ? initialData.title || "" : ""
  );

  const [blocks, setBlocks] = useState<UIWorkoutBlock[]>(
    initialData && initialData.blocks
      ? (initialData.blocks as unknown as UIWorkoutBlock[])
      : []
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  const compactMode = blocks.length >= COMPACT_BLOCK_THRESHOLD;

  const totalSets = useMemo(
    () =>
      blocks.reduce(
        (sum, block) => sum + (block.exercises?.[0]?.sets?.length ?? 0),
        0
      ),
    [blocks]
  );

  const addBlock = useCallback(() => {
    const newBlock: UIWorkoutBlock = {
      id: crypto.randomUUID(),
      workout_id: initialData?.id || "",
      name: "",
      order: blocks.length,
      exercises: [
        {
          id: crypto.randomUUID(),
          name: "",
          sets: [{ id: crypto.randomUUID(), reps: "", weight: "" }],
        },
      ],
    };
    setBlocks((prev) => [...prev, newBlock]);
    setValidationError(null);
    if (compactMode) {
      setExpandedBlockId(newBlock.id);
    }
  }, [blocks.length, compactMode, initialData?.id]);

  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setExpandedBlockId((current) => (current === blockId ? null : current));
  }, []);

  const updateBlockName = useCallback((blockId: string, name: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId) {
          const updatedExercises = (b.exercises || []).map((ex, idx) =>
            idx === 0 ? { ...ex, name } : ex
          );
          return { ...b, name, exercises: updatedExercises };
        }
        return b;
      })
    );
    setValidationError(null);
  }, []);

  const addSet = useCallback((blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;

        const currentExercises = b.exercises || [];
        const updatedExercises = [...currentExercises];

        if (updatedExercises.length === 0) {
          updatedExercises.push({
            id: crypto.randomUUID(),
            name: b.name || "",
            sets: [],
          });
        }

        updatedExercises[0] = {
          ...updatedExercises[0],
          sets: [
            ...(updatedExercises[0].sets || []),
            { id: crypto.randomUUID(), reps: "", weight: "" },
          ],
        };

        return { ...b, exercises: updatedExercises };
      })
    );
  }, []);

  const removeSet = useCallback((blockId: string, setId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId && b.exercises?.[0]) {
          const updatedExercises = [...b.exercises];
          updatedExercises[0] = {
            ...updatedExercises[0],
            sets: (updatedExercises[0].sets || []).filter((s) => s.id !== setId),
          };
          return { ...b, exercises: updatedExercises };
        }
        return b;
      })
    );
  }, []);

  const updateSetData = useCallback(
    (
      blockId: string,
      setId: string,
      field: "reps" | "weight",
      value: string
    ) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id === blockId && b.exercises?.[0]) {
            const updatedExercises = [...b.exercises];
            updatedExercises[0] = {
              ...updatedExercises[0],
              sets: (updatedExercises[0].sets || []).map((s) =>
                s.id === setId ? { ...s, [field]: value } : s
              ),
            };
            return { ...b, exercises: updatedExercises };
          }
          return b;
        })
      );
    },
    []
  );

  const handleToggleExpand = useCallback((blockId: string) => {
    setExpandedBlockId((current) => (current === blockId ? null : blockId));
  }, []);

  const handleSaveWorkout = () => {
    if (!workoutTitle.trim()) {
      setValidationError("ВВЕДИТЕ НАЗВАНИЕ ТРЕНИРОВКИ");
      return;
    }
    if (blocks.length === 0) {
      setValidationError("ДОБАВЬТЕ ХОТЯ БЫ ОДНО УПРАЖНЕНИЕ");
      return;
    }

    setValidationError(null);

    const payload = stampRoutine({
      ...initialData,
      id: initialData?.id || crypto.randomUUID(),
      client_id: initialData?.client_id || clientId,
      trainer_id: initialData?.trainer_id ?? trainerId,
      date: initialData?.date || new Date().toISOString().split("T")[0],
      title: workoutTitle,
      blocks: blocks as unknown as WorkoutBlock[],
      recommendations: initialData?.recommendations || "",
      isPendingSync: !navigator.onLine,
      status: initialData?.status ?? "active",
      is_custom: initialData?.is_custom ?? true,
    } as WorkoutRoutine);

    onSave?.(payload);
  };

  return (
    <div className="space-y-6 font-mono text-[#E1E3E6]">
      <Card className="flex flex-col md:flex-row gap-4 items-center justify-between p-4">
        <div className="w-full md:max-w-md">
          <label className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider block mb-1.5">
            НАЗВАНИЕ ТРЕНИРОВОЧНОЙ СЕССИИ{" "}
            {mode === "client-log" ? "(ЛОГ КЛИЕНТА)" : ""}
          </label>
          <Input
            placeholder="НАПРИМЕР: СИЛОВАЯ А, СТАНОВАЯ + КОР..."
            value={workoutTitle}
            onChange={(e) => {
              setWorkoutTitle(e.target.value);
              setValidationError(null);
            }}
          />
          {compactMode && (
            <p className="text-[8px] text-[#515359] uppercase tracking-wider mt-2">
              {blocks.length} БЛОКОВ · {totalSets} СЕТОВ · КОМПАКТНЫЙ РЕЖИМ
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
          {validationError && (
            <p className="text-[8px] font-bold uppercase tracking-wider text-rose-400">
              {validationError}
            </p>
          )}
          <div className="flex w-full md:w-auto gap-2 self-end md:self-center">
            <Button
              variant="secondary"
              className="flex-1 md:flex-initial h-10 text-[10px]"
            >
              <Eye className="w-3.5 h-3.5 mr-2" /> ПРЕДПРОСМОТР
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveWorkout}
              className="flex-1 md:flex-initial h-10 text-[10px]"
            >
              <Save className="w-3.5 h-3.5 mr-2" /> СОХРАНИТЬ
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <WorkoutBlockCard
            key={block.id}
            block={block}
            index={index}
            compact={compactMode}
            expanded={expandedBlockId === block.id}
            onToggleExpand={handleToggleExpand}
            onRemoveBlock={removeBlock}
            onUpdateBlockName={updateBlockName}
            onAddSet={addSet}
            onRemoveSet={removeSet}
            onUpdateSetData={updateSetData}
          />
        ))}
      </div>

      <Button
        variant="secondary"
        onClick={addBlock}
        className="w-full h-12 border-dashed border-[#222328] hover:border-[#00E676]/30 text-xs tracking-widest text-[#989AA0] hover:text-white transition-all bg-[#111214]/20"
      >
        <Dumbbell className="w-4 h-4 mr-2 text-[#515359]" /> ДОБАВИТЬ
        УПРАЖНЕНИЕ В СЕССИЮ
      </Button>
    </div>
  );
}
