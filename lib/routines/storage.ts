import type { WorkoutRoutine } from "@/db/types";
import { mergeRoutinePair } from "@/lib/routines/conflict";

export const ROUTINES_STORAGE_KEY = "myofitnes_offline_routines";

export function readRoutinesFromStorage(): WorkoutRoutine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROUTINES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkoutRoutine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[routines/storage] parse failed:", err);
    return [];
  }
}

export function writeRoutinesToStorage(routines: WorkoutRoutine[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines));
}

export function mergeRoutines(
  local: WorkoutRoutine[],
  remote: WorkoutRoutine[]
): WorkoutRoutine[] {
  const map = new Map<string, WorkoutRoutine>();

  for (const r of local) {
    map.set(r.date, r);
  }

  for (const r of remote) {
    const existing = map.get(r.date);
    if (!existing) {
      map.set(r.date, r);
      continue;
    }
    map.set(r.date, mergeRoutinePair(existing, r));
  }

  return Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
