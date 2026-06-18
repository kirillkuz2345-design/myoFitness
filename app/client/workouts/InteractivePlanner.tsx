"use client";

import React, { useState, useEffect, memo } from "react";
import {
  Copy,
  ClipboardPaste,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  X,
  Dumbbell,
} from "lucide-react";
import { WorkoutRoutine } from "@/db/types";
import { Card, Button, Input } from "@/components/ui/myo";

interface InteractivePlannerProps {
  routines: WorkoutRoutine[];
  activeDate?: string;
  onDuplicateRoutine: (targetDate: string, sourceRoutine: WorkoutRoutine) => void;
  onSelectDate?: (dateObj: Date) => void;
}

function InteractivePlanner({
  routines,
  activeDate,
  onDuplicateRoutine,
  onSelectDate,
}: InteractivePlannerProps) {
  const [currentDate] = useState(new Date());
  const [copiedRoutine, setCopiedRoutine] = useState<WorkoutRoutine | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(null);
  const [targetDateStr, setTargetDateStr] = useState("");

  useEffect(() => {
    if (!copyNotice) return;
    const timer = window.setTimeout(() => setCopyNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  const daysInWeek = Array.from({ length: 7 }, (_, i) => {
    const current = new Date(currentDate.getTime());
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1) + i;
    return new Date(new Date(currentDate).setDate(diff));
  });

  const getRoutineForDate = (dateStr: string) =>
    routines.find((r) => r.date === dateStr);

  const handleActionPasteInit = (dateStr: string) => {
    if (!copiedRoutine) return;
    setTargetDateStr(dateStr);
    setEditingRoutine({
      ...copiedRoutine,
      id: crypto.randomUUID(),
      date: dateStr,
    });
    setShowEditOverlay(true);
  };

  const handleConfirmOverlay = () => {
    if (editingRoutine && targetDateStr) {
      onDuplicateRoutine(targetDateStr, editingRoutine);
      setShowEditOverlay(false);
      setEditingRoutine(null);
    }
  };

  return (
    <div className="w-full font-mono text-[#E1E3E6] space-y-4">
      <Card className="flex items-center justify-between p-3.5">
        <div className="flex items-center space-x-2.5">
          <Calendar className="h-4 w-4 text-[#00E676]" />
          <div>
            <h2 className="text-xs font-black tracking-widest text-white uppercase">
              СЕТКА ПЛАНИРОВАНИЯ
            </h2>
            <p className="text-[8px] text-[#989AA0] uppercase tracking-wider mt-0.5">
              {copyNotice ?? "УПРАВЛЕНИЕ И ДУБЛИРОВАНИЕ СЕССИЙ"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="secondary" className="h-8 w-8 !p-0 border-zinc-800">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 text-[#989AA0]">
            НЕДЕЛЯ
          </span>
          <Button variant="secondary" className="h-8 w-8 !p-0 border-zinc-800">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {daysInWeek.map((dayObj) => {
          const formattedDate = dayObj.toISOString().split("T")[0];
          const routine = getRoutineForDate(formattedDate);
          const isToday =
            new Date().toISOString().split("T")[0] === formattedDate;
          const isSelected = activeDate === formattedDate;

          return (
            <div
              key={formattedDate}
              onClick={() => onSelectDate?.(dayObj)}
              className="cursor-pointer select-none active:scale-[0.98] transition-all"
            >
              <Card
                className={`p-3 min-h-[150px] h-full flex flex-col justify-between transition-all relative
                  ${isSelected ? "border-[#00E676] bg-[#00E676]/10 ring-1 ring-[#00E676]/30" : ""}
                  ${!isSelected && isToday ? "border-[#00E676]/40 bg-[#00E676]/5 hover:border-[#00E676]/80" : ""}
                  ${!isSelected && !isToday ? "border-[#222328] bg-[#111214]/40 hover:border-zinc-500" : ""}
                `}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#222328]/60 pb-1.5">
                    <span className="text-[9px] font-bold text-[#515359]">
                      {dayObj
                        .toLocaleDateString("ru-RU", { weekday: "short" })
                        .toUpperCase()}
                    </span>
                    <span
                      className={`text-xs font-black tracking-tighter ${isToday || isSelected ? "text-[#00E676]" : "text-white"}`}
                    >
                      {dayObj.getDate()}
                    </span>
                  </div>

                  {routine ? (
                    <div className="p-2 bg-[#0A0A0A] border border-[#222328] rounded space-y-1">
                      <div className="flex items-center gap-1">
                        <Dumbbell className="w-2.5 h-2.5 text-[#00E676]" />
                        <p className="text-[10px] font-bold truncate text-white uppercase tracking-wide">
                          {routine.title}
                        </p>
                      </div>
                      <p className="text-[8px] font-bold text-[#989AA0] uppercase tracking-wider pl-3.5">
                        СЕТОВ/БЛОКОВ: {routine.blocks?.length || 0}
                      </p>
                    </div>
                  ) : (
                    <div className="py-1.5 pl-1">
                      <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">
                        ● ОТДЫХ
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-1 pt-2 border-t border-[#222328]/40">
                  {routine && (
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCopiedRoutine(routine);
                        setCopyNotice(
                          `СКОПИРОВАНО: ${routine.title.toUpperCase()}`
                        );
                      }}
                      className="h-7 w-7 !p-0 border-zinc-800 text-zinc-500 hover:text-white"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                  {copiedRoutine && !routine && (
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionPasteInit(formattedDate);
                      }}
                      className="h-7 w-7 !p-0 border-[#00E676]/30 bg-[#00E676]/5 text-[#00E676] hover:bg-[#00E676] hover:text-black"
                    >
                      <ClipboardPaste className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {showEditOverlay && editingRoutine && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border border-[#00E676]/40 p-5 space-y-5 bg-[#111214] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222328] pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="h-3.5 w-3.5 text-[#00E676]" />
                <h3 className="text-xs font-black uppercase tracking-widest text-white">
                  КОРРЕКТИРОВКА НА ЛЕТУ
                </h3>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowEditOverlay(false)}
                className="h-7 w-7 !p-0 border-zinc-800 text-zinc-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider block">
                НАЗВАНИЕ ТРЕНИРОВОЧНОЙ КОПИИ
              </label>
              <Input
                type="text"
                value={editingRoutine.title}
                onChange={(e) =>
                  setEditingRoutine({ ...editingRoutine, title: e.target.value })
                }
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowEditOverlay(false)}
                className="h-9 text-[10px]"
              >
                ОТМЕНА
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmOverlay}
                className="h-9 text-[10px]"
              >
                ПОДТВЕРДИТЬ ДУБЛИРОВАНИЕ
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default memo(InteractivePlanner);
