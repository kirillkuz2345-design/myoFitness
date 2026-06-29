import { Dexie } from "dexie";

interface Workout {
  id: string;
  client_id: string;
  trainer_id?: string | null;
  date: string;
  updated_at?: string;
  sync_status?: "synced" | "pending" | "failed";
  [key: string]: any;
}

interface WorkoutBlock {
  id: string;
  workout_id: string;
  order: number;
  updated_at?: string;
  sync_status?: "synced" | "pending" | "failed";
  [key: string]: any;
}

interface SyncQueue {
  id?: number;
  table_name: "workouts" | "workout_blocks" | "exercise_sets" | "profiles" | "chat_messages";
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
  timestamp: number;
  status: "pending" | "failed" | "synced";
  retries: number;
}

class MyoFitnessDatabase extends Dexie {
  workouts!: Dexie.Table<Workout, string>;
  workout_blocks!: Dexie.Table<WorkoutBlock, string>;
  sync_queue!: Dexie.Table<SyncQueue, number>;

  constructor() {
    super("MyoFitnessDB");
    this.version(1).stores({
      workouts: "id, client_id, date, [client_id+date]",
      workout_blocks: "id, workout_id, order",
      sync_queue: "++id, status, timestamp"
    });
  }
}

const localDb = new MyoFitnessDatabase();
type QueuePayload = Record<string, unknown>;

function buildQueueItem(
  table_name: SyncQueue["table_name"],
  operation: SyncQueue["operation"],
  payload: QueuePayload
): SyncQueue {
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
    await localDb.transaction(
      "rw",
      [localDb.workouts, localDb.workout_blocks, localDb.sync_queue],
      async () => {
        const nowIso = new Date().toISOString();
        const existingWorkout = await localDb.workouts.get(workout.id);
        
        if (
          existingWorkout && 
          existingWorkout.updated_at && 
          workout.updated_at && 
          new Date(existingWorkout.updated_at) > new Date(workout.updated_at)
        ) {
          console.warn(`[Conflict] Workout ${workout.id} is outdated.`);
          return;
        }

        const workoutOp: SyncQueue["operation"] = existingWorkout ? "UPDATE" : "CREATE";
        const workoutRecord: Workout = { 
          ...workout, 
          updated_at: nowIso,
          sync_status: "pending" 
        };
        
        await localDb.workouts.put(workoutRecord);

        await localDb.sync_queue.add(
          buildQueueItem("workouts", workoutOp, workoutRecord as unknown as QueuePayload)
        );

        const existingBlocks = await localDb.workout_blocks
          .where("workout_id")
          .equals(workout.id)
          .toArray();

        const existingBlockIds = new Set(existingBlocks.map((b: any) => b.id)); 
        const incomingBlockIds = new Set(blocks.map((b: any) => b.id));

        await localDb.workout_blocks
          .where("workout_id")
          .equals(workout.id)
          .delete();

        const normalizedBlocks: WorkoutBlock[] = blocks.map((block, idx) => ({
          ...block,
          workout_id: workout.id,
          order: idx,
          updated_at: nowIso,
          sync_status: "pending" as const,
        }));

        await localDb.workout_blocks.bulkAdd(normalizedBlocks);

        for (const block of normalizedBlocks) {
          const blockOp: SyncQueue["operation"] = existingBlockIds.has(block.id) ? "UPDATE" : "CREATE";
          await localDb.sync_queue.add(
            buildQueueItem("workout_blocks", blockOp, block as unknown as QueuePayload)
          );
        }

        const removedBlocks = existingBlocks.filter((b: any) => !incomingBlockIds.has(b.id));
        for (const block of removedBlocks) {
          await localDb.sync_queue.add(
            buildQueueItem("workout_blocks", "DELETE", {
              id: block.id,
              workout_id: workout.id,
            } as unknown as QueuePayload)
          );
        }
      }
    );
  },

  async getWorkoutWithBlocks(clientId: string, date: string) {
    const workout = await localDb.workouts
      .where("[client_id+date]" as any)
      .equals([clientId, date])
      .first();

    if (!workout) return null;

    const blocks = await localDb.workout_blocks
      .where("workout_id")
      .equals(workout.id)
      .sortBy("order");

    return { workout, blocks };
  },

  async getClientWorkoutsForMonth(clientId: string, year: number, month: number) {
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const endStr = `${year}-${String(month).padStart(2, "0")}-31`;

    return await localDb.workouts
      .where("[client_id+date]" as any)
      .between([clientId, startStr], [clientId, endStr], true, true)
      .toArray();
  }
};