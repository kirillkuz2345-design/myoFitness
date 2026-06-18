import { ensureDbReady } from "@/db/dexie";
import type { Workout, WorkoutBlock, WorkoutRoutine } from "@/db/types";
import { routineContentFingerprint } from "@/lib/routines/conflict";

const lastDexieFingerprint = new Map<string, string>();

export function clearDexieFingerprintCache(workoutId?: string): void {
  if (workoutId) {
    lastDexieFingerprint.delete(workoutId);
    return;
  }
  lastDexieFingerprint.clear();
}

export async function persistRoutineToDexie(
  routine: WorkoutRoutine,
  options?: { force?: boolean }
): Promise<boolean> {
  const fingerprint = routineContentFingerprint(routine);
  if (
    !options?.force &&
    lastDexieFingerprint.get(routine.id) === fingerprint
  ) {
    return false;
  }

  const db = await ensureDbReady();

  const workout: Workout = {
    id: routine.id,
    trainer_id: routine.trainer_id,
    client_id: routine.client_id,
    date: routine.date,
    title: routine.title,
    name: routine.title,
    status: routine.status ?? "active",
    is_custom: routine.is_custom ?? true,
    notes: routine.athleteComment ?? null,
    sync_status: routine.isPendingSync ? "pending" : "synced",
    updated_at: routine.updated_at,
  };

  await db.transaction("rw", [db.workouts, db.workout_blocks], async () => {
    await db.workouts.put(workout);
    await db.workout_blocks.where("workout_id").equals(routine.id).delete();

    const normalized: WorkoutBlock[] = routine.blocks.map((block, idx) => ({
      ...block,
      workout_id: routine.id,
      order: block.order ?? idx,
      sync_status: routine.isPendingSync ? "pending" : "synced",
    }));

    if (normalized.length > 0) {
      await db.workout_blocks.bulkPut(normalized);
    }
  });

  lastDexieFingerprint.set(routine.id, fingerprint);
  return true;
}

export async function removeRoutineFromDexie(workoutId: string): Promise<void> {
  const db = await ensureDbReady();

  await db.transaction("rw", [db.workouts, db.workout_blocks], async () => {
    await db.workout_blocks.where("workout_id").equals(workoutId).delete();
    await db.workouts.delete(workoutId);
  });

  lastDexieFingerprint.delete(workoutId);
}
