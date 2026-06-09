// services/sync.service.ts
import { ensureDbReady } from "../db/dexie";
import type { FitnessPWA } from "../db/dexie";
import type { SyncQueue, WorkoutBlock } from "../db/types";
import { getSupabaseClient } from "../lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildSetsFromBlock(payload: WorkoutBlock): Record<string, unknown>[] {
  const setsToInsert: Record<string, unknown>[] = [];
  const exerciseName = payload.name.trim();

  for (const ex of payload.exercises) {
    const totalSets = ex.sets || 1;
    for (let i = 0; i < totalSets; i++) {
      setsToInsert.push({
        workout_id: payload.workout_id,
        exercise_name: exerciseName,
        set_number: i + 1,
        reps: ex.reps?.toString() || "",
        weight: ex.weight_kg?.toString() || "0",
      });
    }
  }

  return setsToInsert;
}

async function markQueueItemFailed(
  db: FitnessPWA,
  item: SyncQueue
): Promise<void> {
  await db.sync_queue.update(item.id!, {
    status: item.retries >= 3 ? "failed" : "pending",
    retries: item.retries + 1,
  });
}

export const syncService = {
  isSyncing: false,

  async hasPending(): Promise<boolean> {
    try {
      const db = await ensureDbReady();
      const count = await db.sync_queue
        .where("status")
        .equals("pending")
        .count();
      return count > 0;
    } catch (err) {
      console.error("[SyncService] hasPending failed:", err);
      return false;
    }
  },

  async startSyncLoopIfNeeded(): Promise<void> {
    if (!(await this.hasPending())) return;
    return this.startSyncLoop();
  },

  async startSyncLoop() {
    if (this.isSyncing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    this.isSyncing = true;

    const supabase = getSupabaseClient();

    try {
      const db = await ensureDbReady();
      const pendingItems = await db.sync_queue
        .where("status")
        .equals("pending")
        .sortBy("timestamp");

      if (pendingItems.length === 0) return;

      const workoutItems = pendingItems.filter((i) => i.table_name === "workouts");
      const blockItems = pendingItems.filter((i) => i.table_name === "workout_blocks");
      const profileItems = pendingItems.filter((i) => i.table_name === "profiles");
      const noteItems = pendingItems.filter(
        (i) => i.table_name === "trainer_client_notes"
      );

      for (const item of profileItems) {
        if (!navigator.onLine) break;

        const success = await this.syncProfile(item, supabase, db);
        if (success) {
          await db.sync_queue.delete(item.id!);
        } else {
          await markQueueItemFailed(db, item);
        }
      }

      for (const item of noteItems) {
        if (!navigator.onLine) break;

        const success = await this.syncTrainerClientNote(item, supabase, db);
        if (success) {
          await db.sync_queue.delete(item.id!);
        } else {
          await markQueueItemFailed(db, item);
        }
      }

      for (const item of workoutItems) {
        if (!navigator.onLine) break;

        const success = await this.syncWorkout(item, supabase, db);
        if (success) {
          await db.sync_queue.delete(item.id!);
        } else {
          await markQueueItemFailed(db, item);
        }
      }

      if (navigator.onLine && blockItems.length > 0) {
        await this.syncWorkoutBlocksBatch(blockItems, supabase, db);
      }
    } catch (err) {
      console.error("[SyncService] Ошибка в цикле синхронизации:", err);
    } finally {
      this.isSyncing = false;
    }
  },

  async syncWorkoutBlocksBatch(
    items: SyncQueue[],
    supabase: SupabaseClient,
    db: FitnessPWA
  ): Promise<void> {
    const deleteItems = items.filter((i) => i.operation === "DELETE");
    const upsertItems = items.filter(
      (i) => i.operation === "CREATE" || i.operation === "UPDATE"
    );

    const deletesByWorkout = new Map<string, SyncQueue[]>();
    for (const item of deleteItems) {
      const payload = item.payload as { workout_id: string };
      const list = deletesByWorkout.get(payload.workout_id) ?? [];
      list.push(item);
      deletesByWorkout.set(payload.workout_id, list);
    }

    for (const [workoutId, workoutDeletes] of deletesByWorkout) {
      const names = workoutDeletes.map((i) =>
        String((i.payload as { name: string }).name).trim()
      );

      try {
        const { error } = await supabase
          .from("workout_sets")
          .delete()
          .eq("workout_id", workoutId)
          .in("exercise_name", names);

        if (error) throw error;

        for (const item of workoutDeletes) {
          await db.sync_queue.delete(item.id!);
        }
      } catch (e) {
        console.error("[SyncService] Batch DELETE blocks failed:", e);
        for (const item of workoutDeletes) {
          await markQueueItemFailed(db, item);
        }
      }
    }

    const upsertsByWorkout = new Map<string, SyncQueue[]>();
    for (const item of upsertItems) {
      const payload = item.payload as unknown as WorkoutBlock;
      const list = upsertsByWorkout.get(payload.workout_id) ?? [];
      list.push(item);
      upsertsByWorkout.set(payload.workout_id, list);
    }

    for (const [, workoutUpserts] of upsertsByWorkout) {
      const workoutId = (workoutUpserts[0].payload as unknown as WorkoutBlock)
        .workout_id;
      const exerciseNames = [
        ...new Set(
          workoutUpserts.map((i) =>
            String((i.payload as unknown as WorkoutBlock).name).trim()
          )
        ),
      ];

      try {
        const { error: deleteError } = await supabase
          .from("workout_sets")
          .delete()
          .eq("workout_id", workoutId)
          .in("exercise_name", exerciseNames);

        if (deleteError) throw deleteError;

        const setsToInsert = workoutUpserts.flatMap((item) =>
          buildSetsFromBlock(item.payload as unknown as WorkoutBlock)
        );

        if (setsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from("workout_sets")
            .insert(setsToInsert);
          if (insertError) throw insertError;
        }

        for (const item of workoutUpserts) {
          const payload = item.payload as unknown as WorkoutBlock;
          await db.workout_blocks.update(payload.id, { sync_status: "synced" });
          await db.sync_queue.delete(item.id!);
        }
      } catch (e) {
        console.error("[SyncService] Batch UPSERT blocks failed:", e);
        for (const item of workoutUpserts) {
          await markQueueItemFailed(db, item);
        }
      }
    }
  },

  async syncProfile(
    item: SyncQueue,
    supabase: SupabaseClient,
    db: FitnessPWA
  ): Promise<boolean> {
    try {
      const payload = item.payload as {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        gender: string | null;
        height_cm: number | null;
        weight_kg: number | null;
      };

      if (item.operation === "CREATE" || item.operation === "UPDATE") {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: payload.full_name,
            avatar_url: payload.avatar_url,
            gender: payload.gender,
            height_cm: payload.height_cm,
            weight_kg: payload.weight_kg,
          })
          .eq("id", payload.id);

        if (error) throw error;
        await db.profiles.update(payload.id, { sync_status: "synced" });
      }
      return true;
    } catch (e) {
      console.error("[SyncService] syncProfile failed:", e);
      return false;
    }
  },

  async syncTrainerClientNote(
    item: SyncQueue,
    supabase: SupabaseClient,
    db: FitnessPWA
  ): Promise<boolean> {
    try {
      const payload = item.payload as {
        id: string;
        trainer_id: string;
        client_id: string;
        notes: string | null;
        updated_at: number;
      };

      if (item.operation === "CREATE" || item.operation === "UPDATE") {
        const { error } = await supabase.from("trainer_client_notes").upsert(
          {
            trainer_id: payload.trainer_id,
            client_id: payload.client_id,
            notes: payload.notes,
            updated_at: new Date(payload.updated_at).toISOString(),
          },
          { onConflict: "trainer_id,client_id" }
        );

        if (error) throw error;
        await db.trainer_client_notes.update(payload.id, {
          sync_status: "synced",
        });
      }

      if (item.operation === "DELETE") {
        const { error } = await supabase
          .from("trainer_client_notes")
          .delete()
          .eq("trainer_id", payload.trainer_id)
          .eq("client_id", payload.client_id);

        if (error) throw error;
      }

      return true;
    } catch (e) {
      console.error("[SyncService] syncTrainerClientNote failed:", e);
      return false;
    }
  },

  async syncWorkout(
    item: SyncQueue,
    supabase: SupabaseClient,
    db: FitnessPWA
  ): Promise<boolean> {
    try {
      const payload = item.payload as {
        id: string;
        client_id: string;
        trainer_id: string;
        date: string;
        title: string;
        status?: string;
        is_custom?: boolean;
      };

      if (item.operation === "CREATE" || item.operation === "UPDATE") {
        // ИСПРАВЛЕНО: Безопасная обработка trainer_id и сохранение динамического статуса воркаута
        const rawTrainerId = payload.trainer_id ? payload.trainer_id.trim() : "";
        const finalTrainerId = rawTrainerId === "" ? null : rawTrainerId;

        const { error } = await supabase.from("workouts").upsert({
          id: payload.id,
          client_id: payload.client_id,
          trainer_id: finalTrainerId, 
          date: payload.date,
          name: payload.title,
          status: payload.status || "active",
          is_custom: payload.is_custom ?? false
        });

        if (error) throw error;
        await db.workouts.update(payload.id, { sync_status: "synced" });
      }
      return true;
    } catch (e) {
      console.error("[SyncService] syncWorkout failed:", e);
      return false;
    }
  },
};