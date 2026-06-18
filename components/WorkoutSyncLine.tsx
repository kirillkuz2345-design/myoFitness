"use client";

import type { SyncStatus } from "@/hooks/useWorkoutRoutines";

interface WorkoutSyncLineProps {
  online: boolean;
  syncStatus: SyncStatus;
  isPendingLocal?: boolean;
}

export function WorkoutSyncLine({
  online,
  syncStatus,
  isPendingLocal = false,
}: WorkoutSyncLineProps) {
  let message = "READY // CORE";
  let tone = "text-[#989AA0]";

  if (!online || syncStatus === "offline") {
    message = "ALL CHANGES SAVED LOCAL";
    tone = "text-zinc-500";
  } else if (syncStatus === "syncing") {
    message = "SYNCING // CORE...";
    tone = "text-amber-400/90";
  } else if (syncStatus === "error") {
    message = "SYNC ERR — RETRY ON RECONNECT";
    tone = "text-rose-400/90";
  } else if (isPendingLocal) {
    message = "PENDING UPLOAD...";
    tone = "text-amber-400/80";
  } else if (syncStatus === "synced") {
    message = "ALL CHANGES SYNCED";
    tone = "text-[#00E676]/80";
  }

  return (
    <p
      className={`text-[8px] font-bold uppercase tracking-[0.2em] ${tone} transition-colors duration-300`}
      aria-live="polite"
    >
      {message}
    </p>
  );
}
