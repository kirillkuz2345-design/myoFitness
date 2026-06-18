import { db, type Workout, type WorkoutBlock, type SyncQueue } from "../db/dexie";

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
  /**
   * Атомарно создает/обновляет тренировку и её блоки,
   * записывая каждое изменение в sync_queue для последующего офлайн-синка.
   */
  async saveWorkoutWithBlocks(
    workout: Workout,
    blocks: WorkoutBlock[]
  ): Promise<void> {
    await db.transaction(
      "rw",
      ["workouts", "workout_blocks", "sync_queue"],
      async () => {
        // 1. Проверяем, существует ли уже тренировка (CREATE или UPDATE)
        const existingWorkout = await db.workouts.get(workout.id);
        const workoutOp: SyncQueue["operation"] = existingWorkout ? "UPDATE" : "CREATE";

        const workoutRecord: Workout = { ...workout, sync_status: "pending" };
        await db.workouts.put(workoutRecord);

        // Добавляем саму тренировку в очередь очистки
        await db.sync_queue.add(
          buildQueueItem("workouts", workoutOp, workoutRecord as unknown as QueuePayload)
        );

        // 2. Делаем слепок старых блоков, чтобы понять, что было удалено
        const existingBlocks = await db.workout_blocks
          .where("workout_id")
          .equals(workout.id)
          .toArray();

        const existingBlockIds = new Set(existingBlocks.map((b) => b.id)); 
        const incomingBlockIds = new Set(blocks.map((b) => b.id));

        // 3. Очищаем старые blocks в локальной БД, чтобы избежать дублей при перестановке
        await db.workout_blocks
          .where("workout_id")
          .equals(workout.id)
          .delete();

        // 4. Загружаем новые блоки с выставлением правильного порядка (index)
        const normalizedBlocks: WorkoutBlock[] = blocks.map((block, idx) => ({
          ...block,
          workout_id: workout.id,
          order: idx,
          sync_status: "pending" as const,
        }));

        await db.workout_blocks.bulkAdd(normalizedBlocks);

        // 5. Закидываем в очередь операции создания/обновления для каждого блока
        for (const block of normalizedBlocks) {
          const blockOp: SyncQueue["operation"] = existingBlockIds.has(block.id) ? "UPDATE" : "CREATE";
          await db.sync_queue.add(
            buildQueueItem("workout_blocks", blockOp, block as unknown as QueuePayload)
          );
        }

        // 6. Находим блоки, которые тренер удалил при редактировании, и пишем DELETE в очередь
        const removedBlocks = existingBlocks.filter((b) => !incomingBlockIds.has(b.id));
        for (const block of removedBlocks) {
          await db.sync_queue.add(
            buildQueueItem("workout_blocks", "DELETE", {
              id: block.id,
              workout_id: workout.id,
            } as unknown as QueuePayload)
          );
        }
      }
    );
  },

  /**
   * Достает тренировку и все её упражнения для конкретного клиента на выбранную дату
   */
  async getWorkoutWithBlocks(clientId: string, date: string) {
    const workout = await db.workouts
      .where("[client_id+date]" as any)
      .equals([clientId, date])
      .first();

    if (!workout) return null;

    const blocks = await db.workout_blocks
      .where("workout_id")
      .equals(workout.id)
      .sortBy("order");

    return { workout, blocks };
  },

  /**
   * Достает все тренировки клиента за определенный месяц (для календаря)
   */
  async getClientWorkoutsForMonth(clientId: string, year: number, month: number) {
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const endStr = `${year}-${String(month).padStart(2, "0")}-31`;

    return await db.workouts
      .where("[client_id+date]" as any)
      .between([clientId, startStr], [clientId, endStr], true, true)
      .toArray();
  }
};