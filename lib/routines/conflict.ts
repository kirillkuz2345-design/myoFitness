import type { WorkoutRoutine } from "@/db/types";

export function parseRoutineTimestamp(ts?: string | number | null): number {
  if (ts == null) return 0;
  if (typeof ts === "number") return ts;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function stampRoutine(
  routine: WorkoutRoutine,
  at?: string
): WorkoutRoutine {
  return {
    ...routine,
    updated_at: at ?? new Date().toISOString(),
  };
}

export function isLocalNewerThanRemote(
  local: WorkoutRoutine,
  remote: WorkoutRoutine
): boolean {
  return (
    parseRoutineTimestamp(local.updated_at) >
    parseRoutineTimestamp(remote.updated_at)
  );
}

/**
 * Last-write-wins merge for a single date slot.
 * Pending local edits lose to a newer remote trainer revision.
 */
export function mergeRoutinePair(
  local: WorkoutRoutine,
  remote: WorkoutRoutine
): WorkoutRoutine {
  if (local.isPendingSync) {
    if (isLocalNewerThanRemote(local, remote)) {
      return local;
    }
    return { ...remote, isPendingSync: false };
  }

  if (isLocalNewerThanRemote(local, remote)) {
    return { ...local, isPendingSync: false };
  }

  return { ...remote, isPendingSync: false };
}

export function shouldPushLocalRoutine(
  local: WorkoutRoutine,
  remote: WorkoutRoutine | null
): boolean {
  if (!local.isPendingSync) return true;
  if (!remote) return true;
  return isLocalNewerThanRemote(local, remote);
}

export function routineContentFingerprint(routine: WorkoutRoutine): string {
  const blockSig = routine.blocks
    .map(
      (b) =>
        `${b.id}:${b.name}:${b.exercises?.length ?? 0}:${
          b.exercises?.[0]?.reps ?? ""
        }`
    )
    .join("|");
  return [
    routine.id,
    routine.date,
    routine.title,
    routine.updated_at ?? "",
    String(routine.blocks.length),
    blockSig,
  ].join("::");
}
