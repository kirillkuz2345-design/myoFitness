// db/types.ts
import type { User } from "@supabase/supabase-js";

export type UserRole = "trainer" | "client";
export type Gender = "male" | "female" | "other" | null;
export type WeightUnit = "kg" | "lbs";

export interface LocalProfile {
  id: string;
  updated_at: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  trainer_id: string | null;
  gender: Gender;
  height_cm: number | null;
  weight_kg: number | null;
  sync_status: "synced" | "pending";
}

export interface ExerciseSet {
  id: string;
  setNumber: number;          // Поддержка старого формата тренера
  set_number?: number;        // Поддержка нового snake_case
  sets?: number;              // Совместимость с легаси
  weight: number | null;
  weight_kg?: number | null;  // Сделано опциональным, чтобы не ломать PremiumWorkoutBuilder
  isBodyweight: boolean;
  reps: number;
  isDone?: boolean;
  actualWeight?: number | null;
  actualReps?: number;
}

export interface WorkoutBlock {
  id: string;
  workout_id: string; 
  name: string;
  order: number;
  exercises: ExerciseSet[];
  sync_status?: "synced" | "pending";
}

export interface Workout {
  id: string;
  trainer_id: string | null;
  client_id: string;
  date: string;
  title: string;
  name: string;
  status: string;
  is_custom: boolean;
  notes: string | null;
  sync_status: "synced" | "pending";
  updated_at?: string;
}

export interface WorkoutRoutine {
  id: string;
  client_id: string;
  trainer_id: string | null;
  date: string;
  title: string;
  blocks: WorkoutBlock[];
  recommendations: string;
  athleteComment?: string;
  isPendingSync: boolean;
  status?: string;
  is_custom?: boolean;
  updated_at?: string;
}

/** Row shape for Supabase `workouts` table (blocks stored as JSONB). */
export interface WorkoutRoutineRow {
  id: string;
  client_id: string;
  trainer_id: string | null;
  date: string;
  name: string;
  title?: string;
  status: string;
  is_custom: boolean;
  notes: string | null;
  blocks: WorkoutBlock[];
  recommendations: string;
  athlete_comment: string | null;
  updated_at?: string;
}

export interface TrainerClientNote {
  id: string;
  trainer_id: string;
  client_id: string;
  notes: string | null;
  updated_at: number;
  sync_status: "synced" | "pending";
}

export interface SyncQueue {
  id?: number;
  table_name: "workouts" | "workout_blocks" | "profiles" | "trainer_client_notes" | "messages" | "local_messages";
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: any;
  status: "pending" | "processing" | "failed";
  retries: number;
  timestamp: number;
}

// Гибридный интерфейс чата: поддерживает и старый ContextChatEngine, и новый app/page.tsx
export interface ChatMessage {
  id: string;
  sender_id?: string;
  sender_role?: "trainer" | "client";
  sender?: "trainer" | "athlete" | string; // Возвращаем поддержку старого поля
  text: string;
  timestamp: number;
  is_edited?: boolean;
  anchor_workout_id?: string | null;
  anchorWorkout?: {                        // Возвращаем поддержку легаси-объекта привязки
    id: string;
    title: string;
    date: string;
  };
}

export interface LocalMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_role?: "trainer" | "client";
  sender?: string;
  text: string;
  timestamp: number;
  created_at?: string;
  is_edited?: boolean;
  sync_status: "synced" | "pending";
}