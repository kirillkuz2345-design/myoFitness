"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import PremiumWorkoutBuilder from "./PremiumWorkoutBuilder";
import InteractivePlanner from "./InteractivePlanner";
import ContextChatEngine from "@/app/chat/[id]/ContextChatEngine";
import { WorkoutRoutine } from "@/db/types";
import { Card } from "@/components/ui/myo";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkoutRoutines } from "@/hooks/useWorkoutRoutines";
import { useRoutineRealtime } from "@/hooks/useRoutineRealtime";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { WorkoutSyncLine } from "@/components/WorkoutSyncLine";

export default function MyoPlannerDashboard() {
  const { user, profile } = useAuth();
  const userId = user?.id;

  const {
    routines,
    hydrated,
    syncStatus,
    persistRoutine,
    setRoutines,
  } = useWorkoutRoutines(userId);

  const [activeRoutine, setActiveRoutine] = useState<WorkoutRoutine | null>(null);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useRoutineRealtime({
    clientId: userId,
    setRoutines,
    setActiveRoutine,
  });

  useEffect(() => {
    const onStatus = () => setOnline(navigator.onLine);
    window.addEventListener("online", onStatus);
    window.addEventListener("offline", onStatus);
    return () => {
      window.removeEventListener("online", onStatus);
      window.removeEventListener("offline", onStatus);
    };
  }, []);

  const handlePersistWorkout = useCallback(
    (updatedRoutine: WorkoutRoutine) => {
      const withMeta: WorkoutRoutine = {
        ...updatedRoutine,
        client_id: updatedRoutine.client_id || userId || "",
        trainer_id: updatedRoutine.trainer_id ?? profile?.trainer_id ?? null,
        isPendingSync: !navigator.onLine,
      };
      persistRoutine(withMeta);
      setActiveRoutine(withMeta);
    },
    [userId, profile?.trainer_id, persistRoutine]
  );

  const handleDuplicatePlannerRoutine = useCallback(
    (targetDate: string, clonedRoutine: WorkoutRoutine) => {
      const duplicate: WorkoutRoutine = {
        ...clonedRoutine,
        id: crypto.randomUUID(),
        date: targetDate,
        client_id: clonedRoutine.client_id || userId || "",
        trainer_id: clonedRoutine.trainer_id ?? profile?.trainer_id ?? null,
        isPendingSync: !navigator.onLine,
      };
      persistRoutine(duplicate);
      setActiveRoutine(duplicate);
    },
    [userId, profile?.trainer_id, persistRoutine]
  );

  const handleNavigateToDateContext = useCallback(
    (dateObj: Date) => {
      const tzOffset = dateObj.getTimezoneOffset() * 60000;
      const localISOTime = new Date(dateObj.getTime() - tzOffset);
      const dateStr = localISOTime.toISOString().split("T")[0];

      const routine = routines.find((r) => r.date === dateStr);
      if (routine) {
        setActiveRoutine(routine);
      } else {
        setActiveRoutine({
          id: crypto.randomUUID(),
          client_id: userId || "",
          trainer_id: profile?.trainer_id ?? null,
          date: dateStr,
          title: "",
          blocks: [],
          recommendations: "",
          isPendingSync: false,
        });
      }
    },
    [routines, userId, profile?.trainer_id]
  );

  const builderKey = activeRoutine
    ? `routine-${activeRoutine.date}`
    : "routine-empty";

  const chatContextKey = activeRoutine?.date ?? "chat-empty";

  const resolvedActiveRoutine = useMemo(() => {
    if (!activeRoutine?.date) return activeRoutine;
    return routines.find((r) => r.date === activeRoutine.date) ?? activeRoutine;
  }, [activeRoutine, routines]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] p-4 md:p-6 space-y-6 font-mono antialiased selection:bg-[#00E676] selection:text-black">
      <Card className="max-w-7xl mx-auto flex justify-between items-center p-4 border border-[#222328]">
        <div>
          <h1 className="text-sm font-black uppercase tracking-widest text-white">
            VIBEFITNESS <span className="text-[#00E676]">CORE</span>
          </h1>
          <p className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider mt-0.5">
            PREMIUM WORKSPACE v2.0
          </p>
        </div>
        <SyncStatusBadge online={online} syncStatus={syncStatus} />
      </Card>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <InteractivePlanner
            routines={routines}
            activeDate={activeRoutine?.date}
            onDuplicateRoutine={handleDuplicatePlannerRoutine}
            onSelectDate={handleNavigateToDateContext}
          />

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 px-1">
              <div>
                <p className="text-[9px] font-bold text-[#515359] uppercase tracking-widest">
                  АКТИВНАЯ СЕССИЯ
                </p>
                <p className="text-xs font-black text-white uppercase tracking-wider mt-0.5">
                  {activeRoutine?.date ?? "ВЫБЕРИТЕ ДАТУ В СЕТКЕ"}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-1">
                <SyncStatusBadge online={online} syncStatus={syncStatus} />
                <WorkoutSyncLine
                  online={online}
                  syncStatus={syncStatus}
                  isPendingLocal={resolvedActiveRoutine?.isPendingSync}
                />
              </div>
            </div>

            <PremiumWorkoutBuilder
              key={builderKey}
              mode="client-log"
              initialData={resolvedActiveRoutine}
              clientId={userId}
              trainerId={profile?.trainer_id ?? null}
              onSave={handlePersistWorkout}
            />
          </div>
        </div>

        <div className="lg:col-span-4 w-full">
          <Card className="p-1 border border-[#222328] bg-[#111214]/30 h-full min-h-[500px]">
            <ContextChatEngine
              key={chatContextKey}
              currentUserRole="athlete"
              activeRoutineContext={resolvedActiveRoutine}
              onNavigateToWorkout={(dateStr: string) =>
                handleNavigateToDateContext(new Date(dateStr))
              }
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
