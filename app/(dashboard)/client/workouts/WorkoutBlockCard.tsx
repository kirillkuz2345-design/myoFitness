"use client";

import React, { memo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, Button, Input } from "@/components/ui/myo";

export interface UIWorkoutSet {
  id: string;
  reps: string;
  weight: string;
}

export interface UIWorkoutExercise {
  id: string;
  name: string;
  sets: UIWorkoutSet[];
}

export interface UIWorkoutBlock {
  id: string;
  workout_id: string;
  name: string;
  order: number;
  exercises: UIWorkoutExercise[];
}

interface WorkoutBlockCardProps {
  block: UIWorkoutBlock;
  index: number;
  compact: boolean;
  expanded: boolean;
  onToggleExpand: (blockId: string) => void;
  onRemoveBlock: (blockId: string) => void;
  onUpdateBlockName: (blockId: string, name: string) => void;
  onAddSet: (blockId: string) => void;
  onRemoveSet: (blockId: string, setId: string) => void;
  onUpdateSetData: (
    blockId: string,
    setId: string,
    field: "reps" | "weight",
    value: string
  ) => void;
}

function WorkoutBlockCardComponent({
  block,
  index,
  compact,
  expanded,
  onToggleExpand,
  onRemoveBlock,
  onUpdateBlockName,
  onAddSet,
  onRemoveSet,
  onUpdateSetData,
}: WorkoutBlockCardProps) {
  const mainExercise = block.exercises?.[0];
  const sets = mainExercise?.sets || [];
  const showSets = !compact || expanded;
  const setCount = sets.length;

  return (
    <Card className="p-4 border border-[#222328] bg-[#111214]/50 relative">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-[#222328] pb-3 mb-4">
        <div className="flex items-center gap-3 w-full sm:max-w-md">
          <span className="text-[10px] font-black text-[#515359]">
            #{String(index + 1).padStart(2, "0")}
          </span>
          {compact && (
            <button
              type="button"
              onClick={() => onToggleExpand(block.id)}
              className="text-[8px] font-bold uppercase tracking-wider text-[#989AA0] hover:text-white"
            >
              {expanded ? "СВЕРНУТЬ" : `РАЗВЕРНУТЬ (${setCount} СЕТ.)`}
            </button>
          )}
          <Input
            placeholder="УКАЖИТЕ НАЗВАНИЕ УПРАЖНЕНИЯ..."
            value={block.exercises?.[0]?.name || ""}
            onChange={(e) => onUpdateBlockName(block.id, e.target.value)}
            className="h-8 !text-xs font-bold bg-transparent border-b border-transparent hover:border-zinc-800 focus:border-[#00E676]"
          />
        </div>
        <Button
          variant="danger"
          onClick={() => onRemoveBlock(block.id)}
          className="h-8 px-2.5 sm:self-center self-end"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {showSets && (
        <>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[9px] font-bold text-[#515359] uppercase tracking-wider px-1">
              <div className="col-span-2 text-center">СЕТ</div>
              <div className="col-span-4">ВЕС (КГ)</div>
              <div className="col-span-4">ПОВТОРЕНИЯ</div>
              <div className="col-span-2" />
            </div>

            {sets.map((set, setIndex) => (
              <div
                key={set.id || setIndex}
                className="grid grid-cols-12 gap-2 items-center"
              >
                <div className="col-span-2 text-center text-xs font-bold text-zinc-500 bg-[#0A0A0A] border border-[#222328] h-9 flex items-center justify-center rounded">
                  {setIndex + 1}
                </div>

                <div className="col-span-4">
                  <Input
                    placeholder="0"
                    value={set.weight || ""}
                    onChange={(e) =>
                      onUpdateSetData(block.id, set.id, "weight", e.target.value)
                    }
                    className="h-9 text-center text-xs text-white"
                  />
                </div>

                <div className="col-span-4">
                  <Input
                    placeholder="0"
                    value={set.reps || ""}
                    onChange={(e) =>
                      onUpdateSetData(block.id, set.id, "reps", e.target.value)
                    }
                    className="h-9 text-center text-xs text-white"
                  />
                </div>

                <div className="col-span-2 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => onRemoveSet(block.id, set.id)}
                    disabled={sets.length === 1}
                    className="h-9 w-full !p-0 border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-900/50 disabled:opacity-30"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-start">
            <Button
              variant="secondary"
              onClick={() => onAddSet(block.id)}
              className="h-7 text-[9px] border-dashed border-[#222328] hover:border-zinc-700 px-3"
            >
              <Plus className="w-3 h-3 mr-1" /> ДОБАВИТЬ СЕТ
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

const WorkoutBlockCard = memo(WorkoutBlockCardComponent);
export default WorkoutBlockCard;
