// db/types.ts
export type UserRole = "trainer" | "client";
export type Gender = "male" | "female" | "other";
export type SyncStatus = "pending" | "synced";

export interface LocalProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  trainer_id: string | null;
  gender: Gender | null;
  height_cm: number | null;
  weight_kg: number | null;
  sync_status: SyncStatus;
  updated_at: number;
}

export interface TrainerClientNote {
  id: string;
  trainer_id: string;
  client_id: string;
  notes: string | null;
  sync_status: SyncStatus;
  updated_at: number;
}

export interface Workout {
  id: string;
  trainer_id: string;
  client_id: string;
  date: string;
  title: string;
  name: string;          // Добавлено
  status: string;        // Добавлено
  is_custom: boolean;    // Добавлено
  notes: string | null;
  sync_status: SyncStatus;
}

export interface WorkoutBlock {
  id: string;
  workout_id: string;
  name: string;
  order: number;
  exercises: Exercise[];
  sync_status: SyncStatus;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
  notes: string | null;
}

export type SyncTableName =
  | "workouts"
  | "workout_blocks"
  | "local_messages"
  | "profiles"
  | "trainer_client_notes";

export interface SyncQueue {
  id?: number;
  table_name: SyncTableName;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
  timestamp: number;
  status: "pending" | "failed";
  retries: number;
}

export interface LocalMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  workout_context_id?: string;
  timestamp: number;
  sync_status: SyncStatus;
}

export function trainerClientNoteId(trainerId: string, clientId: string): string {
  return `${trainerId}__${clientId}`;
}