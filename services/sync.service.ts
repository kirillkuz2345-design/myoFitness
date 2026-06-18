// services/sync.service.ts
import { ensureDbReady } from "../db/dexie";
import type { FitnessPWA } from "../db/dexie";
import type { SyncQueue, WorkoutBlock } from "../db/types";
import { getSupabaseClient } from "../lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRoutineTimestamp } from "@/lib/routines/conflict";

const MAX_SYNC_RETRIES = 3;

function buildSetsFromBlock(payload: WorkoutBlock): Record<string, unknown>[] {
  const setsToInsert: Record<string, unknown>[] = [];
  const exerciseName = payload.name.trim();

  for (const ex of payload.exercises) {
    const totalSets = ex.sets || 1;
    for (let i = 0; i < totalSets; i++) {
      setsToInsert.push({
        workout_id: payload.workout_id,
        block_id: payload.id,
        exercise_name: exerciseName,
        set_number: i + 1,
        reps: ex.reps?.toString() || "",
        weight: ex.weight_kg?.toString() || "0",
      });
    }
  }
  return setsToInsert;
}

async function markQueueItemFailed(db: FitnessPWA, item: SyncQueue): Promise<void> {
  const nextRetries = item.retries + 1;
  await db.sync_queue.update(item.id!, {
    status: nextRetries >= MAX_SYNC_RETRIES ? "failed" : "pending",
    retries: nextRetries,
  });
}

async function claimQueueItem(db: FitnessPWA, item: SyncQueue): Promise<void> {
  await db.sync_queue.update(item.id!, { status: "processing" });
}

async function resetStaleProcessingItems(db: FitnessPWA): Promise<void> {
  const stale = await db.sync_queue.where("status").equals("processing").toArray();
  for (const item of stale) {
    if (item.id != null) {
      await db.sync_queue.update(item.id, { status: "pending" });
    }
  }
}

function isRetryableQueueItem(item: SyncQueue): boolean {
  return (
    item.status === "pending" ||
    (item.status === "failed" && item.retries < MAX_SYNC_RETRIES)
  );
}

export const syncService = {
  isSyncing: false,

  async hasPending(): Promise<boolean> {
    try {
      const db = await ensureDbReady();
      const items = await db.sync_queue.toArray();
      return items.some(isRetryableQueueItem);
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
      await resetStaleProcessingItems(db);

      const allItems = await db.sync_queue.toArray();
      const pendingItems = allItems
        .filter(isRetryableQueueItem)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (pendingItems.length === 0) return;

      const workoutItems = pendingItems.filter((i) => i.table_name === "workouts");
      const blockItems = pendingItems.filter((i) => i.table_name === "workout_blocks");
      const profileItems = pendingItems.filter((i) => i.table_name === "profiles");
      const noteItems = pendingItems.filter((i) => i.table_name === "trainer_client_notes");

      // ИСПРАВЛЕНИЕ ИСКАЖЕНИЯ №5: Блокируем элементы в базе перед отправкой в сеть
      for (const item of profileItems) {
        if (!navigator.onLine) break;
        await claimQueueItem(db, item);

        const success = await this.syncProfile(item, supabase, db);
        if (success) {
          await db.sync_queue.delete(item.id!);
        } else {
          await markQueueItemFailed(db, item);
        }
      }

      for (const item of noteItems) {
        if (!navigator.onLine) break;
        await claimQueueItem(db, item);

        const success = await this.syncTrainerClientNote(item, supabase, db);
        if (success) {
          await db.sync_queue.delete(item.id!);
        } else {
          await markQueueItemFailed(db, item);
        }
      }

      for (const item of workoutItems) {
        if (!navigator.onLine) break;
        await claimQueueItem(db, item);

        const success = await this.syncWorkout(item, supabase, db);
        if (success) {
          await db.sync_queue.delete(item.id!);
        } else {
          await markQueueItemFailed(db, item);
        }
      }

      if (navigator.onLine && blockItems.length > 0) {
        const uniqueBlocksMap = new Map<string, SyncQueue>();

        for (const item of blockItems) {
          const payload = item.payload as { id: string };
          const blockId = payload.id;

          if (!uniqueBlocksMap.has(blockId)) {
            uniqueBlocksMap.set(blockId, item);
          } else {
            const previousItem = uniqueBlocksMap.get(blockId)!;
            if (previousItem.operation === "CREATE" && item.operation === "DELETE") {
              uniqueBlocksMap.delete(blockId);
              if (previousItem.id) await db.sync_queue.delete(previousItem.id);
              if (item.id) await db.sync_queue.delete(item.id);
            } else {
              previousItem.payload = item.payload;
              previousItem.operation = previousItem.operation === "CREATE" ? "CREATE" : item.operation;
              previousItem.timestamp = item.timestamp;
              if (item.id) await db.sync_queue.delete(item.id);
            }
          }
        }

        const cleanBlockItems = Array.from(uniqueBlocksMap.values());
        if (cleanBlockItems.length > 0) {
          for (const item of cleanBlockItems) {
            if (!navigator.onLine) break;
            if (item.id != null) await claimQueueItem(db, item);
            await this.syncSingleWorkoutBlock(item, supabase, db);
          }
        }
      }
    } catch (err) {
      console.error("[SyncService] Ошибка в цикле синхронизации:", err);
    } finally {
      this.isSyncing = false;
    }
  },

  async syncSingleWorkoutBlock(
    item: SyncQueue,
    supabase: SupabaseClient,
    db: FitnessPWA
  ): Promise<void> {
    if (item.operation === "DELETE") {
      const payload = item.payload as { id: string; workout_id: string };
      try {
        const { error } = await supabase
          .from("workout_sets")
          .delete()
          .eq("workout_id", payload.workout_id)
          .eq("block_id", payload.id);

        if (error) throw error;
        await db.sync_queue.delete(item.id!);
      } catch (e) {
        console.error("[SyncService] DELETE block failed:", payload.id, e);
        await markQueueItemFailed(db, item);
      }
      return;
    }

    const payload = item.payload as unknown as WorkoutBlock;
    try {
      const { error: deleteError } = await supabase
        .from("workout_sets")
        .delete()
        .eq("workout_id", payload.workout_id)
        .eq("block_id", payload.id);

      if (deleteError) throw deleteError;

      const setsToInsert = buildSetsFromBlock(payload);
      if (setsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("workout_sets")
          .insert(setsToInsert);
        if (insertError) throw insertError;
      }

      await db.workout_blocks.update(payload.id, { sync_status: "synced" });
      await db.sync_queue.delete(item.id!);
    } catch (e) {
      console.error("[SyncService] UPSERT block failed:", payload.id, e);
      await markQueueItemFailed(db, item);
    }
  },

  async syncWorkoutBlocksBatch(items: SyncQueue[], supabase: SupabaseClient, db: FitnessPWA): Promise<void> {
    const deleteItems = items.filter((i) => i.operation === "DELETE");
    const upsertItems = items.filter((i) => i.operation === "CREATE" || i.operation === "UPDATE");

    const deletesByWorkout = new Map<string, SyncQueue[]>();
    for (const item of deleteItems) {
      const payload = item.payload as { workout_id: string };
      const list = deletesByWorkout.get(payload.workout_id) ?? [];
      list.push(item);
      deletesByWorkout.set(payload.workout_id, list);
    }

    for (const [workoutId, workoutDeletes] of deletesByWorkout) {
      const blockIds = workoutDeletes.map((i) => String((i.payload as { id: string }).id));
      try {
        const { error } = await supabase
          .from("workout_sets")
          .delete()
          .eq("workout_id", workoutId)
          .in("block_id", blockIds);

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
      const workoutId = (workoutUpserts[0].payload as unknown as WorkoutBlock).workout_id;
      const blockIds = workoutUpserts.map((i) => String((i.payload as unknown as WorkoutBlock).id));

      try {
        const { error: deleteError } = await supabase
          .from("workout_sets")
          .delete()
          .eq("workout_id", workoutId)
          .in("block_id", blockIds);

        if (deleteError) throw deleteError;

        const setsToInsert = workoutUpserts.flatMap((item) =>
          buildSetsFromBlock(item.payload as unknown as WorkoutBlock)
        );

        if (setsToInsert.length > 0) {
          const { error: insertError } = await supabase.from("workout_sets").insert(setsToInsert);
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

  async syncProfile(item: SyncQueue, supabase: SupabaseClient, db: FitnessPWA): Promise<boolean> {
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

  async syncTrainerClientNote(item: SyncQueue, supabase: SupabaseClient, db: FitnessPWA): Promise<boolean> {
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
        await db.trainer_client_notes.update(payload.id, { sync_status: "synced" });
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

  async syncWorkout(item: SyncQueue, supabase: SupabaseClient, db: FitnessPWA): Promise<boolean> {
    try {
      const payload = item.payload as {
        id: string;
        client_id: string;
        trainer_id: string;
        date: string;
        title: string;
        status?: string;
        is_custom?: boolean;
        updated_at?: string;
      };

      if (item.operation === "CREATE" || item.operation === "UPDATE") {
        const { data: remoteRow } = await supabase
          .from("workouts")
          .select("updated_at")
          .eq("id", payload.id)
          .maybeSingle();

        const remoteUpdatedAt = remoteRow?.updated_at as string | undefined;
        if (
          remoteUpdatedAt &&
          payload.updated_at &&
          parseRoutineTimestamp(remoteUpdatedAt) >
            parseRoutineTimestamp(payload.updated_at)
        ) {
          await db.workouts.update(payload.id, { sync_status: "synced" });
          return true;
        }

        const rawTrainerId = payload.trainer_id ? payload.trainer_id.trim() : "";
        const finalTrainerId = rawTrainerId === "" ? null : rawTrainerId;

        const { error } = await supabase.from("workouts").upsert({
          id: payload.id,
          client_id: payload.client_id,
          trainer_id: finalTrainerId,
          date: payload.date,
          name: payload.title,
          status: payload.status || "active",
          is_custom: payload.is_custom ?? false,
          updated_at: payload.updated_at ?? new Date().toISOString(),
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