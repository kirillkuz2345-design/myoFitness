// services/profile.service.ts
import { ensureDbReady } from "../db/dexie";
import type { LocalProfile } from "../db/types";
import { getSupabaseClient } from "../lib/supabase/client";

export const profileService = {
  async getLocalProfile(userId: string): Promise<LocalProfile | null> {
    const db = await ensureDbReady();
    const profile = await db.profiles.get(userId);
    return profile ?? null;
  },

  async cacheProfileLocally(profile: LocalProfile): Promise<LocalProfile> {
    const db = await ensureDbReady();
    await db.profiles.put(profile);
    return profile;
  },

  async saveProfile(profile: LocalProfile): Promise<void> {
    const db = await ensureDbReady();
    await db.transaction("rw", [db.profiles, db.sync_queue], async () => {
      await db.profiles.put(profile);
      await db.sync_queue.add({
        table_name: "profiles",
        operation: "UPDATE",
        payload: profile,
        timestamp: Date.now(),
        status: "pending",
        retries: 0,
      });
    });
  },

  async hydrateProfileIfOnline(userId: string): Promise<LocalProfile | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) return null;

    const local: LocalProfile = {
      id: data.id,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      role: data.role,
      trainer_id: data.trainer_id,
      gender: data.gender,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      sync_status: "synced",
      updated_at: data.updated_at || new Date().toISOString(),
    };

    return this.cacheProfileLocally(local);
  },

  async getTrainerClients(trainerId: string): Promise<LocalProfile[]> {
    const db = await ensureDbReady();
    return db.profiles.where("trainer_id").equals(trainerId).toArray();
  },

  async hydrateTrainerClientsIfOnline(trainerId: string): Promise<LocalProfile[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("trainer_id", trainerId);

    if (error || !data) return [];

    const db = await ensureDbReady();
    const normalized: LocalProfile[] = data.map((item) => ({
      id: item.id,
      full_name: item.full_name,
      avatar_url: item.avatar_url,
      role: item.role,
      trainer_id: item.trainer_id,
      gender: item.gender,
      height_cm: item.height_cm,
      weight_kg: item.weight_kg,
      sync_status: "synced",
      updated_at: item.updated_at || new Date().toISOString(),
    }));

    if (normalized.length > 0) {
      await db.profiles.bulkPut(normalized);
    }
    return normalized;
  },

  async getTrainerClientNote(trainerId: string, clientId: string) {
    const db = await ensureDbReady();
    return db.trainer_client_notes.where("[trainer_id+client_id]").equals([trainerId, clientId]).first();
  },

  async saveTrainerClientNote(trainerId: string, clientId: string, notes: string): Promise<void> {
    const db = await ensureDbReady();
    const id = `${trainerId}_${clientId}`;
    const record = {
      id,
      trainer_id: trainerId,
      client_id: clientId,
      notes,
      sync_status: "pending" as const,
      updated_at: Date.now(),
    };

    await db.transaction("rw", [db.trainer_client_notes, db.sync_queue], async () => {
      await db.trainer_client_notes.put(record);
      await db.sync_queue.add({
        table_name: "trainer_client_notes",
        operation: "UPDATE",
        payload: record,
        timestamp: Date.now(),
        status: "pending",
        retries: 0,
      });
    });
  },

  async hydrateTrainerNotesIfOnline(trainerId: string, clientIds: string[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || clientIds.length === 0) return;

    const { data, error } = await supabase
      .from("trainer_client_notes")
      .select("*")
      .eq("trainer_id", trainerId)
      .in("client_id", clientIds);

    if (error || !data) return;

    const db = await ensureDbReady();
    const records = data.map((item) => ({
      id: `${item.trainer_id}_${item.client_id}`,
      trainer_id: item.trainer_id,
      client_id: item.client_id,
      notes: item.notes,
      sync_status: "synced" as const,
      updated_at: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
    }));

    if (records.length > 0) {
      await db.trainer_client_notes.bulkPut(records);
    }
  }
};