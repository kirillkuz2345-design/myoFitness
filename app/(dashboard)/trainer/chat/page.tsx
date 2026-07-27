// app/(dashboard)/trainer/chat/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { MessageSquare, ChevronRight } from "lucide-react";

interface ClientRow {
  id: string;
  full_name: string | null;
}

export default function TrainerChatListPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || profile?.role?.toUpperCase() !== "TRAINER")) {
      router.replace("/login");
    }
  }, [authLoading, user, profile, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "client")
      .eq("trainer_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setClients(data as ClientRow[]);
        setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-4">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Чаты с атлетами</h2>

      {fetching ? (
        <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-6 text-center">
          <span className="text-xs text-zinc-600 animate-pulse">Загрузка...</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-[#1C1C1E] rounded-2xl text-[10px] text-zinc-600 uppercase">
          Нет привязанных атлетов
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => router.push(`/chat/${c.id}`)}
              className="w-full flex items-center gap-3 rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 text-left hover:border-[#262626] transition-colors"
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-[#1C1C1E] flex items-center justify-center text-[#00E676]">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="flex-1 min-w-0 text-xs font-bold text-white truncate">
                {c.full_name || "Атлет без имени"}
              </span>
              <ChevronRight className="w-4 h-4 text-[#989AA0] shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
