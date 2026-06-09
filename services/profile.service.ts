import { ensureDbReady } from "../db/dexie";
import type { FitnessPWA } from "../db/dexie";
import type {
  LocalProfile,
  SyncQueue,
  TrainerClientNote,
  UserRole,
} from "../db/types";
import { trainerClientNoteId } from "../db/types";
import { getSupabaseClient } from "../lib/supabase/client";

const PROFILE_REMOTE_SELECT =
  "id, full_name, avatar_url, role, trainer_id, gender, height_cm, weight_kg";

const PROFILE_REMOTE_SELECT_BASE =
  "id, full_name, avatar_url, role, trainer_id";

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

function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

async function withDb<T>(label: string, fn: (db: FitnessPWA) => Promise<T>): Promise<T> {
  try {
    const db = await ensureDbReady();
    return await fn(db);
  } catch (err) {
    console.error(`[profileService] ${label} failed:`, err);
    throw err;
  }
}

export const profileService = {
  async getLocalProfile(userId: string): Promise<LocalProfile | undefined> {
    return withDb("getLocalProfile", (db) => db.profiles.get(userId));
  },

  async cacheProfileLocally(
    profile: Omit<LocalProfile, "sync_status" | "updated_at"> & {
      sync_status?: LocalProfile["sync_status"];
      updated_at?: number;
    }
  ): Promise<LocalProfile> {
    const record: LocalProfile = {
      ...profile,
      sync_status: profile.sync_status ?? "synced",
      updated_at: profile.updated_at ?? Date.now(),
    };
    await withDb("cacheProfileLocally", (db) => db.profiles.put(record));
    return record;
  },

  async saveProfile(profile: LocalProfile): Promise<void> {
    const record: LocalProfile = {
      ...profile,
      sync_status: "pending",
      updated_at: Date.now(),
    };

    await withDb("saveProfile", async (db) => {
      await db.transaction("rw", [db.profiles, db.sync_queue], async () => {
        const existing = await db.profiles.get(profile.id);
        const operation: SyncQueue["operation"] = existing ? "UPDATE" : "CREATE";

        await db.profiles.put(record);
        await db.sync_queue.add(
          buildQueueItem("profiles", operation, record as unknown as QueuePayload)
        );
      });
    });
  },

  async getTrainerClients(trainerId: string): Promise<LocalProfile[]> {
    return withDb("getTrainerClients", (db) =>
      db.profiles
        .where("trainer_id")
        .equals(trainerId)
        .filter((p) => p.role === "client")
        .toArray()
    );
  },

  async getTrainerClientNote(
    trainerId: string,
    clientId: string
  ): Promise<TrainerClientNote | undefined> {
    return withDb("getTrainerClientNote", (db) =>
      db.trainer_client_notes.get(trainerClientNoteId(trainerId, clientId))
    );
  },

  async saveTrainerClientNote(
    trainerId: string,
    clientId: string,
    notes: string | null
  ): Promise<TrainerClientNote> {
    const id = trainerClientNoteId(trainerId, clientId);
    const record: TrainerClientNote = {
      id,
      trainer_id: trainerId,
      client_id: clientId,
      notes: notes?.trim() || null,
      sync_status: "pending",
      updated_at: Date.now(),
    };

    await withDb("saveTrainerClientNote", async (db) => {
      await db.transaction(
        "rw",
        [db.trainer_client_notes, db.sync_queue],
        async () => {
          const existing = await db.trainer_client_notes.get(id);
          const operation: SyncQueue["operation"] = existing ? "UPDATE" : "CREATE";

          await db.trainer_client_notes.put(record);
          await db.sync_queue.add(
            buildQueueItem(
              "trainer_client_notes",
              operation,
              record as unknown as QueuePayload
            )
          );
        }
      );
    });

    return record;
  },

  async hydrateProfileIfOnline(userId: string): Promise<LocalProfile | null> {
    if (!isOnline()) return null;

    const supabase = getSupabaseClient();
    let data: Record<string, unknown> | null = null;

    const full = await supabase
      .from("profiles")
      .select(PROFILE_REMOTE_SELECT)
      .eq("id", userId)
      .maybeSingle();

    if (full.error) {
      console.warn(
        "[profileService] Full profile select failed, retrying base columns:",
        full.error.message
      );
      const base = await supabase
        .from("profiles")
        .select(PROFILE_REMOTE_SELECT_BASE)
        .eq("id", userId)
        .maybeSingle();
      if (base.error) {
        console.error("[profileService] hydrate profile:", base.error.message);
        return null;
      }
      data = base.data as Record<string, unknown> | null;
    } else {
      data = full.data as Record<string, unknown> | null;
    }

    if (!data) return null;

    try {
      return await this.cacheProfileLocally({
        id: data.id as string,
        full_name: (data.full_name as string | null) ?? null,
        avatar_url: (data.avatar_url as string | null) ?? null,
        role: data.role as UserRole,
        trainer_id: (data.trainer_id as string | null) ?? null,
        gender: (data.gender as LocalProfile["gender"]) ?? null,
        height_cm: (data.height_cm as number | null) ?? null,
        weight_kg: (data.weight_kg as number | null) ?? null,
        sync_status: "synced",
      });
    } catch (err) {
      console.error("[profileService] Could not cache hydrated profile:", err);
      return {
        id: data.id as string,
        full_name: (data.full_name as string | null) ?? null,
        avatar_url: (data.avatar_url as string | null) ?? null,
        role: data.role as UserRole,
        trainer_id: (data.trainer_id as string | null) ?? null,
        gender: (data.gender as LocalProfile["gender"]) ?? null,
        height_cm: (data.height_cm as number | null) ?? null,
        weight_kg: (data.weight_kg as number | null) ?? null,
        sync_status: "synced",
        updated_at: Date.now(),
      };
    }
  },

  async hydrateTrainerClientsIfOnline(
    trainerId: string
  ): Promise<LocalProfile[]> {
    if (!isOnline()) return [];

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_REMOTE_SELECT_BASE)
      .eq("role", "client")
      .eq("trainer_id", trainerId);

    if (error || !data) {
      if (error) {
        console.error("[profileService] hydrate clients:", error.message);
      }
      return [];
    }

    const cached: LocalProfile[] = [];
    for (const row of data) {
      const r = row as Record<string, unknown>;
      try {
        const profile = await this.cacheProfileLocally({
          id: r.id as string,
          full_name: (r.full_name as string | null) ?? null,
          avatar_url: (r.avatar_url as string | null) ?? null,
          role: "client",
          trainer_id: (r.trainer_id as string | null) ?? trainerId,
          gender: (r.gender as LocalProfile["gender"]) ?? null,
          height_cm: (r.height_cm as number | null) ?? null,
          weight_kg: (r.weight_kg as number | null) ?? null,
          sync_status: "synced",
        });
        cached.push(profile);
      } catch (err) {
        console.error("[profileService] Skip caching client row:", r.id, err);
      }
    }
    return cached;
  },

  async hydrateTrainerNotesIfOnline(
    trainerId: string,
    clientIds: string[]
  ): Promise<void> {
    if (!isOnline() || clientIds.length === 0) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("trainer_client_notes")
      .select("trainer_id, client_id, notes, updated_at")
      .eq("trainer_id", trainerId)
      .in("client_id", clientIds);

    if (error) {
      console.warn(
        "[profileService] trainer_client_notes table unavailable:",
        error.message
      );
      return;
    }

    if (!data) return;

    try {
      await withDb("hydrateTrainerNotes", async (db) => {
        for (const row of data) {
          const note: TrainerClientNote = {
            id: trainerClientNoteId(row.trainer_id, row.client_id),
            trainer_id: row.trainer_id,
            client_id: row.client_id,
            notes: row.notes ?? null,
            sync_status: "synced",
            updated_at: row.updated_at
              ? new Date(row.updated_at).getTime()
              : Date.now(),
          };
          await db.trainer_client_notes.put(note);
        }
      });
    } catch (err) {
      console.error("[profileService] Could not cache trainer notes:", err);
    }
  },
};
