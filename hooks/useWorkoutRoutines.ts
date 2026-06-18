"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkoutRoutine } from "@/db/types";
import { routineRepository } from "@/services/routine.repository";
import {
  mergeRoutines,
  readRoutinesFromStorage,
  writeRoutinesToStorage,
} from "@/lib/routines/storage";
import { persistRoutineToDexie } from "@/lib/routines/dexie-sync";
import { stampRoutine } from "@/lib/routines/conflict";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

const DEXIE_DEBOUNCE_MS = 350;

function periodBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

export function useWorkoutRoutines(userId: string | undefined) {
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const syncingRef = useRef(false);
  const dexieTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    const local = readRoutinesFromStorage();
    setRoutines(local);
    setHydrated(true);

    return () => {
      dexieTimersRef.current.forEach((timer) => clearTimeout(timer));
      dexieTimersRef.current.clear();
    };
  }, []);

  const scheduleDexiePersist = useCallback((routine: WorkoutRoutine) => {
    const existing = dexieTimersRef.current.get(routine.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      persistRoutineToDexie(routine).catch((err) => {
        console.error("[useWorkoutRoutines] dexie save failed:", err);
      });
      dexieTimersRef.current.delete(routine.id);
    }, DEXIE_DEBOUNCE_MS);

    dexieTimersRef.current.set(routine.id, timer);
  }, []);

  const revalidate = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    try {
      const { start, end } = periodBounds();
      const remote = await routineRepository.fetchWorkoutsByPeriod(
        userId,
        start,
        end
      );
      setRoutines((prev) => {
        const merged = mergeRoutines(prev, remote);
        writeRoutinesToStorage(merged);
        return merged;
      });
    } catch (err) {
      console.error("[useWorkoutRoutines] revalidate failed:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !hydrated) return;
    revalidate();
  }, [userId, hydrated, revalidate]);

  const runSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) {
      if (!navigator.onLine) setSyncStatus("offline");
      return;
    }

    const current = readRoutinesFromStorage();
    const pending = current.filter((r) => r.isPendingSync);
    if (pending.length === 0) {
      setSyncStatus(navigator.onLine ? "synced" : "offline");
      return;
    }

    syncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const { synced, failed, superseded } =
        await routineRepository.syncPendingRoutines(current);

      const supersededDates = new Set(superseded.map((r) => r.date));

      setRoutines((prev) => {
        const syncedIds = new Set(synced.map((s) => s.id));
        const next = prev.map((r) => {
          const remoteWinner = superseded.find((s) => s.date === r.date);
          if (remoteWinner && supersededDates.has(r.date)) {
            return remoteWinner;
          }
          if (syncedIds.has(r.id)) {
            return (
              synced.find((s) => s.id === r.id) ?? {
                ...r,
                isPendingSync: false,
              }
            );
          }
          if (failed.includes(r.id)) return r;
          return r.isPendingSync ? { ...r, isPendingSync: false } : r;
        });
        writeRoutinesToStorage(next);
        return next;
      });

      for (const routine of synced) {
        scheduleDexiePersist(routine);
      }

      setSyncStatus(failed.length > 0 ? "error" : "synced");
    } catch (err) {
      console.error("[useWorkoutRoutines] sync failed:", err);
      setSyncStatus("error");
    } finally {
      syncingRef.current = false;
    }
  }, [scheduleDexiePersist]);

  useEffect(() => {
    const onOnline = () => {
      setSyncStatus("syncing");
      runSync().then(() => revalidate());
    };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) runSync();
    return () => window.removeEventListener("online", onOnline);
  }, [runSync, revalidate]);

  const persistRoutine = useCallback(
    (updated: WorkoutRoutine) => {
      const stamped = stampRoutine(updated);

      setRoutines((prev) => {
        const exists = prev.some(
          (r) => r.id === stamped.id || r.date === stamped.date
        );
        const next = exists
          ? prev.map((r) =>
              r.id === stamped.id || r.date === stamped.date
                ? { ...stamped, id: r.id || stamped.id }
                : r
            )
          : [...prev, { ...stamped, id: stamped.id || crypto.randomUUID() }];

        writeRoutinesToStorage(next);
        return next;
      });

      scheduleDexiePersist(stamped);

      if (navigator.onLine) {
        setSyncStatus("syncing");
        routineRepository
          .saveWorkoutRoutine({ ...stamped, isPendingSync: false })
          .then((saved) => {
            setRoutines((prev) => {
              const next = prev.map((r) =>
                r.id === saved.id || r.date === saved.date ? saved : r
              );
              writeRoutinesToStorage(next);
              return next;
            });
            persistRoutineToDexie(saved, { force: true }).catch((err) => {
              console.error("[persistRoutine] dexie sync failed:", err);
            });
            setSyncStatus("synced");
          })
          .catch((err) => {
            console.error("[persistRoutine] remote save failed:", err);
            setRoutines((prev) => {
              const withPending = prev.map((r) =>
                r.id === stamped.id || r.date === stamped.date
                  ? { ...stamped, isPendingSync: true }
                  : r
              );
              writeRoutinesToStorage(withPending);
              return withPending;
            });
            setSyncStatus("error");
          });
      } else {
        setSyncStatus("offline");
      }
    },
    [scheduleDexiePersist]
  );

  return {
    routines,
    hydrated,
    syncStatus,
    persistRoutine,
    revalidate,
    runSync,
    setRoutines,
  };
}
