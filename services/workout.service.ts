import { ensureDbReady } from "../db/dexie";
import type { Workout, WorkoutBlock, SyncQueue } from "../db/types";

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

export const workoutService = {
  async saveWorkoutWithBlocks(
    workout: Workout,
    blocks: WorkoutBlock[]
  ): Promise<void> {
    const db = await ensureDbReady();

    await db.transaction(
      "rw",
      [db.workouts, db.workout_blocks, db.sync_queue],
      async () => {
        const existingWorkout = await db.workouts.get(workout.id);
        const workoutOp: SyncQueue["operation"] = existingWorkout
          ? "UPDATE"
          : "CREATE";

        // Сохраняем заметки (notes) вместе с остальными данными тренировки
        const workoutRecord: Workout = { 
          ...workout, 
          notes: workout.notes || null,
          sync_status: "pending" 
        };
        await db.workouts.put(workoutRecord);

        await db.sync_queue.add(
          buildQueueItem("workouts", workoutOp, workoutRecord as unknown as QueuePayload)
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

  async getWorkoutWithBlocks(clientId: string, date: string) {
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