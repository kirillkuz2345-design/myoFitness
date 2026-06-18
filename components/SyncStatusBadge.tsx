"use client";

import type { SyncStatus } from "@/hooks/useWorkoutRoutines";

const LABELS: Record<SyncStatus, string> = {
  idle: "IDLE",
  syncing: "SYNCING",
  synced: "SYNCED",
  offline: "OFFLINE",
  error: "SYNC ERR",
};

const DOT: Record<SyncStatus, string> = {
  idle: "bg-zinc-600",
  syncing: "bg-amber-400 animate-pulse",
  synced: "bg-[#00E676]",
  offline: "bg-zinc-500",
  error: "bg-rose-500",
};

interface SyncStatusBadgeProps {
  online: boolean;
  syncStatus: SyncStatus;
}

export function SyncStatusBadge({ online, syncStatus }: SyncStatusBadgeProps) {
  const display = online ? syncStatus : "offline";

  return (
    <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider text-[#989AA0]">
      <span className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${online ? "bg-[#00E676]" : "bg-zinc-600"}`}
        />
        {online ? "ONLINE" : "OFFLINE"}
      </span>
      <span className="text-zinc-700">//</span>
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${DOT[display]}`} />
        {LABELS[display]}
      </span>
    </div>
  );
}
