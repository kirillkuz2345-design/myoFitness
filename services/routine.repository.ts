import { getSupabaseClient } from "@/lib/supabase/client";
import type { WorkoutBlock, WorkoutRoutine, WorkoutRoutineRow } from "@/db/types";
import {
  shouldPushLocalRoutine,
  stampRoutine,
} from "@/lib/routines/conflict";

function rowToRoutine(row: WorkoutRoutineRow): WorkoutRoutine {
  const blocks = Array.isArray(row.blocks) ? row.blocks : [];
  return {
    id: row.id,
    client_id: row.client_id,
    trainer_id: row.trainer_id,
    date: row.date,
    title: row.title || row.name || "",
    blocks,
    recommendations: row.recommendations ?? "",
    athleteComment: row.athlete_comment ?? undefined,
    isPendingSync: false,
    status: row.status,
    is_custom: row.is_custom,
    updated_at: row.updated_at,
  };
}

function routineToRow(routine: WorkoutRoutine): WorkoutRoutineRow {
  const updatedAt = routine.updated_at ?? new Date().toISOString();
  return {
    id: routine.id,
    client_id: routine.client_id,
    trainer_id: routine.trainer_id,
    date: routine.date,
    name: routine.title,
    title: routine.title,
    status: routine.status ?? "active",
    is_custom: routine.is_custom ?? true,
    notes: routine.athleteComment ?? null,
    blocks: routine.blocks,
    recommendations: routine.recommendations ?? "",
    athlete_comment: routine.athleteComment ?? null,
    updated_at: updatedAt,
  };
}

const ROUTINE_SELECT =
  "id, client_id, trainer_id, date, name, title, status, is_custom, notes, blocks, recommendations, athlete_comment, updated_at";

export type RoutineChangeEvent =
  | { type: "upsert"; routine: WorkoutRoutine }
  | { type: "delete"; workoutId: string; date: string };

export const routineRepository = {
  async fetchWorkoutsByPeriod(
    userId: string,
    start: string,
    end: string
  ): Promise<WorkoutRoutine[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("workouts")
      .select(ROUTINE_SELECT)
      .eq("client_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });

    if (error) {
      // Graceful fallback if JSONB columns not migrated yet
      if (error.message.includes("blocks") || error.code === "42703") {
        const fallback = await supabase
          .from("workouts")
          .select("id, client_id, trainer_id, date, name, status, is_custom, notes")
          .eq("client_id", userId)
          .gte("date", start)
          .lte("date", end)
          .order("date", { ascending: true });

        if (fallback.error) throw fallback.error;
        return (fallback.data ?? []).map((row) =>
          rowToRoutine({
            ...row,
            title: row.name,
            blocks: [],
            recommendations: "",
            athlete_comment: row.notes,
          } as WorkoutRoutineRow)
        );
      }
      throw error;
    }

    return (data as WorkoutRoutineRow[]).map(rowToRoutine);
  },

  async fetchRoutineByWorkoutId(
    workoutId: string,
    clientId: string
  ): Promise<WorkoutRoutine | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("workouts")
      .select(ROUTINE_SELECT)
      .eq("id", workoutId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error || !data) return null;

    let routine = rowToRoutine(data as WorkoutRoutineRow);

    if (routine.blocks.length === 0) {
      const { data: blocks, error: blocksError } = await supabase
        .from("workout_blocks")
        .select("id, workout_id, name, order, exercises")
        .eq("workout_id", workoutId)
        .order("order", { ascending: true });

      if (!blocksError && blocks?.length) {
        routine = {
          ...routine,
          blocks: blocks as WorkoutBlock[],
        };
      }
    }

    return routine;
  },

  async saveWorkoutRoutine(routine: WorkoutRoutine): Promise<WorkoutRoutine> {
    const supabase = getSupabaseClient();
    const row = routineToRow(stampRoutine({ ...routine, isPendingSync: false }));

    const { data, error } = await supabase
      .from("workouts")
      .upsert(row, { onConflict: "id" })
      .select(ROUTINE_SELECT)
      .single();

    if (error) {
      // Fallback without JSONB columns
      const minimal = {
        id: row.id,
        client_id: row.client_id,
        trainer_id: row.trainer_id,
        date: row.date,
        name: row.name,
        status: row.status,
        is_custom: row.is_custom,
        notes: row.athlete_comment,
      };
      const { data: fbData, error: fbError } = await supabase
        .from("workouts")
        .upsert(minimal, { onConflict: "id" })
        .select("id, client_id, trainer_id, date, name, status, is_custom, notes")
        .single();
      if (fbError) throw fbError;
      return rowToRoutine({
        ...(fbData as WorkoutRoutineRow),
        blocks: routine.blocks,
        recommendations: routine.recommendations,
        athlete_comment: routine.athleteComment ?? null,
      });
    }

    return rowToRoutine(data as WorkoutRoutineRow);
  },

  async syncPendingRoutines(
    routines: WorkoutRoutine[]
  ): Promise<{
    synced: WorkoutRoutine[];
    failed: string[];
    superseded: WorkoutRoutine[];
  }> {
    const pending = routines.filter((r) => r.isPendingSync);
    const synced: WorkoutRoutine[] = [];
    const failed: string[] = [];
    const superseded: WorkoutRoutine[] = [];

    for (const routine of pending) {
      try {
        const remote = await this.fetchRoutineByWorkoutId(
          routine.id,
          routine.client_id
        );

        if (!shouldPushLocalRoutine(routine, remote)) {
          if (remote) {
            superseded.push(remote);
            synced.push(remote);
          }
          continue;
        }

        const saved = await this.saveWorkoutRoutine(stampRoutine(routine));
        synced.push(saved);
      } catch (err) {
        console.error("[routineRepository] sync failed:", routine.id, err);
        failed.push(routine.id);
      }
    }

    return { synced, failed, superseded };
  },

  subscribeToClientRoutineChanges(
    clientId: string,
    onEvent: (event: RoutineChangeEvent) => void
  ) {
    const supabase = getSupabaseClient();
    const blockRefetchTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const scheduleBlockRefetch = (workoutId: string) => {
      const existing = blockRefetchTimers.get(workoutId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        blockRefetchTimers.delete(workoutId);
        const routine = await routineRepository.fetchRoutineByWorkoutId(
          workoutId,
          clientId
        );
        if (routine) {
          onEvent({ type: "upsert", routine });
        }
      }, 200);

      blockRefetchTimers.set(workoutId, timer);
    };

    const channel = supabase
      .channel(`routines:client:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workouts",
          filter: `client_id=eq.${clientId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as WorkoutRoutineRow | null;
            if (oldRow?.id) {
              onEvent({
                type: "delete",
                workoutId: oldRow.id,
                date: oldRow.date,
              });
            }
            return;
          }

          const row = payload.new as WorkoutRoutineRow | null;
          if (!row?.id) return;

          let routine = rowToRoutine(row);
          if (routine.blocks.length === 0) {
            const hydrated = await routineRepository.fetchRoutineByWorkoutId(
              row.id,
              clientId
            );
            if (hydrated) routine = hydrated;
          }

          onEvent({ type: "upsert", routine });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workout_blocks",
        },
        (payload) => {
          const workoutId =
            (payload.new as { workout_id?: string } | null)?.workout_id ??
            (payload.old as { workout_id?: string } | null)?.workout_id;

          if (workoutId) scheduleBlockRefetch(workoutId);
        }
      )
      .subscribe();

    return () => {
      blockRefetchTimers.forEach((timer) => clearTimeout(timer));
      blockRefetchTimers.clear();
      supabase.removeChannel(channel);
    };
  },

  /** @deprecated Use subscribeToClientRoutineChanges */
  subscribeToClientWorkouts(
    clientId: string,
    onChange: (routine: WorkoutRoutine) => void
  ) {
    return routineRepository.subscribeToClientRoutineChanges(
      clientId,
      (event) => {
        if (event.type === "upsert") onChange(event.routine);
      }
    );
  },
};
