// services/workout.service.ts
import { ensureDbReady } from "../db/dexie";
import type { Workout, WorkoutBlock, SyncQueue } from "../db/types";
import {
  parseRoutineTimestamp,
  stampRoutine,
} from "@/lib/routines/conflict";
import type { WorkoutRoutine } from "@/db/types";

type QueuePayload = Record<string, unknown>;

function buildQueueItem(
  table_name: SyncQueue["table_name"],
  operation: SyncQueue["operation"],
  payload: QueuePayload
): Omit<SyncQueue, "id"> {
  return {
    table_name,
    operation,
    payload,
    timestamp: Date.now(),
    status: "pending",
    retries: 0,
  };
}

function workoutToRoutine(workout: Workout, blocks: WorkoutBlock[]): WorkoutRoutine {
  return {
    id: workout.id,
    client_id: workout.client_id,
    trainer_id: workout.trainer_id,
    date: workout.date,
    title: workout.title || workout.name,
    blocks,
    recommendations: "",
    isPendingSync: workout.sync_status === "pending",
    status: workout.status,
    is_custom: workout.is_custom,
    updated_at: workout.updated_at,
  };
}

export const workoutService = {
  async saveWorkoutWithBlocks(
    workout: Workout,
    blocks: WorkoutBlock[]
  ): Promise<void> {
    const db = await ensureDbReady();
    const now = new Date().toISOString();

    await db.transaction(
      "rw",
      [db.workouts, db.workout_blocks, db.sync_queue],
      async () => {
        const existingWorkout = await db.workouts.get(workout.id);
        const workoutOp: SyncQueue["operation"] = existingWorkout
          ? "UPDATE"
          : "CREATE";

        const workoutRecord: Workout = {
          ...workout,
          notes: workout.notes || null,
          sync_status: "pending",
          updated_at: now,
        };
        await db.workouts.put(workoutRecord);

        const queuePayload = {
          ...workoutRecord,
          title: workoutRecord.title || workoutRecord.name,
        };

        await db.sync_queue.add(
          buildQueueItem(
            "workouts",
            workoutOp,
            queuePayload as unknown as QueuePayload
          )
        );

        const existingBlocks = await db.workout_blocks
          .where("workout_id")
          .equals(workout.id)
          .toArray();

        const existingBlockIds = new Set(existingBlocks.map((b) => b.id));
        const incomingBlockIds = new Set(blocks.map((b) => b.id));

        await db.workout_blocks.where("workout_id").equals(workout.id).delete();

        const normalizedBlocks: WorkoutBlock[] = blocks.map((block, idx) => ({
          ...block,
          workout_id: workout.id,
          order: idx,
          sync_status: "pending" as const,
        }));

        if (normalizedBlocks.length > 0) {
          await db.workout_blocks.bulkAdd(normalizedBlocks);
        }

        for (const block of normalizedBlocks) {
          const blockOp: SyncQueue["operation"] = existingBlockIds.has(block.id)
            ? "UPDATE"
            : "CREATE";
          await db.sync_queue.add(
            buildQueueItem("workout_blocks", blockOp, block as unknown as QueuePayload)
          );
        }

        const removedBlocks = existingBlocks.filter(
          (b) => !incomingBlockIds.has(b.id)
        );
        for (const block of removedBlocks) {
          await db.sync_queue.add(
            buildQueueItem("workout_blocks", "DELETE", {
              id: block.id,
              workout_id: block.workout_id,
              name: block.name,
            } as unknown as QueuePayload)
          );
        }
      }
    );
  },

  shouldSyncWorkout(
    local: WorkoutRoutine,
    remoteUpdatedAt?: string | null
  ): boolean {
    if (!remoteUpdatedAt) return true;
    const localTs = parseRoutineTimestamp(local.updated_at);
    const remoteTs = parseRoutineTimestamp(remoteUpdatedAt);
    return localTs >= remoteTs;
  },

  stampWorkout(workout: Workout): Workout {
    const routine = stampRoutine(
      workoutToRoutine(workout, [])
    );
    return {
      ...workout,
      updated_at: routine.updated_at,
    };
  },

  async getWorkoutWithBlocks(
    clientId: string,
    date: string
  ): Promise<{ workout: Workout; blocks: WorkoutBlock[] } | null> {
    const db = await ensureDbReady();

    const workout = await db.workouts
      .where("[client_id+date]")
      .equals([clientId, date])
      .first();

    if (!workout) return null;

    const blocks = await db.workout_blocks
      .where("workout_id")
      .equals(workout.id)
      .sortBy("order");

    return { workout, blocks };
  },

  async getClientWorkoutsForMonth(
    clientId: string,
    year: number,
    month: number
  ) {
    const db = await ensureDbReady();
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const endStr = `${year}-${String(month).padStart(2, "0")}-31`;

    return db.workouts
      .where("[client_id+date]")
      .between([clientId, startStr], [clientId, endStr], true, true)
      .toArray();
  },
};
