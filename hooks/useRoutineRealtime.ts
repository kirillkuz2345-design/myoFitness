"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { WorkoutRoutine } from "@/db/types";
import {
  routineRepository,
  type RoutineChangeEvent,
} from "@/services/routine.repository";
import {
  persistRoutineToDexie,
  removeRoutineFromDexie,
} from "@/lib/routines/dexie-sync";
import { mergeRoutines, writeRoutinesToStorage } from "@/lib/routines/storage";

interface UseRoutineRealtimeOptions {
  clientId: string | undefined;
  setRoutines: Dispatch<SetStateAction<WorkoutRoutine[]>>;
  setActiveRoutine: Dispatch<SetStateAction<WorkoutRoutine | null>>;
}

async function applyRoutineEvent(
  event: RoutineChangeEvent,
  setRoutines: UseRoutineRealtimeOptions["setRoutines"],
  setActiveRoutine: UseRoutineRealtimeOptions["setActiveRoutine"]
) {
  if (event.type === "delete") {
    try {
      await removeRoutineFromDexie(event.workoutId);
    } catch (err) {
      console.error("[useRoutineRealtime] dexie delete failed:", err);
    }

    setRoutines((prev) => {
      const next = prev.filter(
        (r) => r.id !== event.workoutId && r.date !== event.date
      );
      writeRoutinesToStorage(next);
      return next;
    });

    setActiveRoutine((current) => {
      if (
        current?.id === event.workoutId ||
        current?.date === event.date
      ) {
        return null;
      }
      return current;
    });
    return;
  }

  try {
    await persistRoutineToDexie(event.routine, { force: true });
  } catch (err) {
    console.error("[useRoutineRealtime] dexie upsert failed:", err);
  }

  setRoutines((prev) => {
    const merged = mergeRoutines(prev, [event.routine]);
    writeRoutinesToStorage(merged);
    return merged;
  });

  setActiveRoutine((current) => {
    if (current?.date === event.routine.date) return event.routine;
    if (current?.id === event.routine.id) return event.routine;
    return current;
  });
}

export function useRoutineRealtime({
  clientId,
  setRoutines,
  setActiveRoutine,
}: UseRoutineRealtimeOptions) {
  useEffect(() => {
    if (!clientId) return;

    const unsubscribe = routineRepository.subscribeToClientRoutineChanges(
      clientId,
      (event) => {
        applyRoutineEvent(event, setRoutines, setActiveRoutine).catch((err) => {
          console.error("[useRoutineRealtime] apply event failed:", err);
        });
      }
    );

    return unsubscribe;
  }, [clientId, setRoutines, setActiveRoutine]);
}
