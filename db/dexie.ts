// db/dexie.ts
import Dexie, { type EntityTable } from "dexie";
import type {
  Workout,
  WorkoutBlock,
  SyncQueue,
  LocalMessage,
  LocalProfile,
  TrainerClientNote,
} from "./types";

export class FitnessPWA extends Dexie {
  workouts!: EntityTable<Workout, "id">;
  workout_blocks!: EntityTable<WorkoutBlock, "id">;
  sync_queue!: EntityTable<SyncQueue, "id">;
  local_messages!: EntityTable<LocalMessage, "id">;
  messages!: EntityTable<any, "id">; // Новая таблица общего контекст-чата
  profiles!: EntityTable<LocalProfile, "id">;
  trainer_client_notes!: EntityTable<TrainerClientNote, "id">;

  constructor() {
    super("FitnessPWA");

    // ИСПРАВЛЕНО: Для предотвращения краша IndexedDB при v1->v2->v3 миграциях,
    // каждая версия должна явно знать о структуре существующих таблиц, 
    // либо модифицировать только дифф (разницу) схем.
    
    this.version(1).stores({
      workouts: "id, trainer_id, client_id, date, sync_status, [client_id+date]",
      workout_blocks: "id, workout_id, order, sync_status",
      sync_queue: "++id, table_name, status, timestamp",
      local_messages: "id, sender_id, receiver_id, workout_context_id, timestamp, sync_status",
    });

    this.version(2).stores({
      workouts: "id, trainer_id, client_id, date, sync_status, [client_id+date]",
      workout_blocks: "id, workout_id, order, sync_status",
      sync_queue: "++id, table_name, status, timestamp",
      local_messages: "id, sender_id, receiver_id, workout_context_id, timestamp, sync_status",
      profiles: "id, role, trainer_id, sync_status",
      trainer_client_notes: "id, trainer_id, client_id, sync_status, [trainer_id+client_id]",
    });

    this.version(3).stores({
      workouts: "id, trainer_id, client_id, date, sync_status, [client_id+date]",
      workout_blocks: "id, workout_id, order, sync_status",
      sync_queue: "++id, table_name, status, timestamp",
      local_messages: "id, sender_id, receiver_id, workout_context_id, timestamp, sync_status",
      profiles: "id, role, trainer_id, sync_status",
      trainer_client_notes: "id, trainer_id, client_id, sync_status, [trainer_id+client_id]",
      messages: "id, sender_id, timestamp", // Добавили индексы для глобального контекст-чата app/page.tsx
    });
  }
}

let dbInstance: FitnessPWA | null = null;
let openPromise: Promise<FitnessPWA> | null = null;

export function getDatabase(): FitnessPWA {
  if (typeof window === "undefined") {
    return new FitnessPWA();
  }
  if (!dbInstance) {
    dbInstance = new FitnessPWA();
  }
  return dbInstance;
}

/**
 * Resolves when IndexedDB is open and migrations (v1→v2→v3) are complete.
 * All Dexie reads/writes must go through this on the client.
 */
export async function ensureDbReady(): Promise<FitnessPWA> {
  if (typeof window === "undefined") {
    throw new Error("[Dexie] IndexedDB is only available in the browser");
  }

  const database = getDatabase();

  if (database.isOpen()) {
    return database;
  }

  if (!openPromise) {
    openPromise = database
      .open()
      .then(() => {
        console.info("[Dexie] Database ready", { version: database.verno });
        return database;
      })
      .catch((err: unknown) => {
        openPromise = null;
        console.error("[Dexie] Failed to open database:", err);
        throw err;
      });
  }

  return openPromise;
}

export function isDbOpen(): boolean {
  return dbInstance?.isOpen() ?? false;
}

/** Clears open state after a fatal error (e.g. from settings "Reset local DB"). */
export function resetDbOpenState(): void {
  openPromise = null;
}

export async function getDb(): Promise<FitnessPWA> {
  return ensureDbReady();
}