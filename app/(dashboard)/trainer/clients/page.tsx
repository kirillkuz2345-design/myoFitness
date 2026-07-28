// app/(dashboard)/trainer/clients/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Users, Sliders, UserPlus, X, Link2, Copy } from "lucide-react";
import { Card, Button, Input } from "@/components/ui/myo";

interface ClientProfile {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  goal?: string | null;
  height?: number | null;
  weight?: number | null;
}

export default function TrainerClientsListPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClientsLoading, setIsClientsLoading] = useState(true);

  // Привязка атлета
  const [showBind, setShowBind] = useState(false);
  const [unassigned, setUnassigned] = useState<ClientProfile[]>([]);
  const [bindLoading, setBindLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchClients = useCallback(async (trainerId: string): Promise<ClientProfile[] | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, goal, height, weight")
        .eq("role", "client")
        .eq("trainer_id", trainerId);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Ошибка синхронизации списка атлетов:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || profile?.role?.toUpperCase() !== "TRAINER")) {
      router.replace("/login");
      return;
    }
    if (!user?.id) return;

    let cancelled = false;
    fetchClients(user.id).then((data) => {
      if (cancelled) return;
      if (data) setClients(data);
      setIsClientsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, profile, loading, router, fetchClients]);

  const refreshClients = async () => {
    if (!user?.id) return;
    const data = await fetchClients(user.id);
    if (data) setClients(data);
  };

  const openBind = async () => {
    setShowBind(true);
    setBindLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "client")
        .is("trainer_id", null);
      if (error) throw error;
      setUnassigned((data as ClientProfile[]) ?? []);
    } catch (err) {
      console.error("Ошибка загрузки непривязанных:", err);
      toast.error("Не удалось загрузить список");
    } finally {
      setBindLoading(false);
    }
  };

  const claim = async (clientId: string) => {
    if (!user?.id) return;
    setClaimingId(clientId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ trainer_id: user.id })
        .eq("id", clientId);
      if (error) throw error;
      setUnassigned((prev) => prev.filter((c) => c.id !== clientId));
      await refreshClients();
      toast.success("Атлет привязан");
    } catch (err) {
      console.error("Ошибка привязки:", err);
      toast.error("Не удалось привязать");
    } finally {
      setClaimingId(null);
    }
  };

  const copyInvite = async () => {
    if (!user?.id) return;
    const link = `${window.location.origin}/invite/${user.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const filteredClients = clients.filter((c) =>
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || isClientsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-2">
        <div className="h-4 w-4 border-2 border-[#00E676] border-t-transparent rounded-full animate-spin" />
        <span className="text-[8px] text-zinc-500 uppercase tracking-widest">
          Синхронизация базы подопечных...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-[#00E676]" />
          <span className="text-[10px] font-black tracking-widest text-[#989AA0] uppercase block">
            Управление атлетами ({filteredClients.length})
          </span>
        </div>
        <button
          type="button"
          onClick={openBind}
          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-[#00E676] text-black px-3 py-1.5 rounded-lg hover:bg-[#00c765] transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Привязать
        </button>
      </div>

      {/* Инпут поиска */}
      <div className="relative">
        <Input
          placeholder="Поиск по имени спортсмена..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Список подопечных */}
      <div className="space-y-2 pt-2">
        {filteredClients.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#1C1C1E] rounded-2xl text-zinc-600 text-xs uppercase font-bold">
            Подопечные не найдены
          </div>
        ) : (
          filteredClients.map((client) => (
            <Card
              key={client.id}
              className="p-4 bg-[#111214] border border-[#1C1C1E] hover:border-zinc-700 transition-colors rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-11 w-11 rounded-full border border-[#1C1C1E] bg-[#0A0A0A] bg-cover bg-center flex items-center justify-center overflow-hidden shrink-0"
                  style={client.avatar_url ? { backgroundImage: `url(${client.avatar_url})` } : undefined}
                >
                  {!client.avatar_url && (
                    <span className="text-[11px] font-black text-[#00E676]">
                      {(client.full_name?.[0] ?? "А").toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <span className="text-xs font-black text-white uppercase block truncate">
                    {client.full_name || "Атлет без имени"}
                  </span>
                  <p className="text-[9px] text-[#989AA0] truncate">
                    {client.goal
                      ? client.goal
                      : [
                          client.weight ? `Вес: ${client.weight} кг` : null,
                          client.height ? `Рост: ${client.height} см` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Описание не заполнено"}
                  </p>
                </div>

                <Button
                  variant="primary"
                  className="!text-[9px] h-8 px-4 font-black shrink-0"
                  onClick={() => router.push(`/trainer/clients/${client.id}`)}
                >
                  <Sliders className="w-3 h-3 mr-1" /> Разбор
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Модалка привязки */}
      {showBind && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Привязать атлета</h3>
              <button type="button" onClick={() => setShowBind(false)} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>
            {/* Персональная ссылка-приглашение */}
            <div className="rounded-xl border border-[#1C1C1E] bg-[#0A0A0A] p-3 space-y-2">
              <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                Персональная ссылка
              </span>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[10px] text-white font-mono truncate">
                  {typeof window !== "undefined" && user?.id ? `${window.location.origin}/invite/${user.id}` : ""}
                </span>
                <button
                  type="button"
                  onClick={copyInvite}
                  className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
                >
                  <Copy className="w-3.5 h-3.5" /> Копир.
                </button>
              </div>
              <p className="text-[8px] text-zinc-600">Отправь атлету — по ней он привяжется к тебе.</p>
            </div>

            <p className="text-[9px] text-[#989AA0] uppercase tracking-wider">
              Или выбери из непривязанных — тап, чтобы взять под себя
            </p>

            <div className="flex-1 overflow-y-auto space-y-2">
              {bindLoading ? (
                <div className="text-center py-8 text-xs text-zinc-600 animate-pulse">Загрузка...</div>
              ) : unassigned.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-zinc-600 uppercase border border-dashed border-[#1C1C1E] rounded-xl">
                  Свободных атлетов нет
                </div>
              ) : (
                unassigned.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-[#1C1C1E] bg-[#0A0A0A] p-3"
                  >
                    <span className="text-xs font-bold text-white truncate">
                      {c.full_name || "Атлет без имени"}
                    </span>
                    <button
                      type="button"
                      onClick={() => claim(c.id)}
                      disabled={claimingId === c.id}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#00E676] hover:text-[#00c765] disabled:opacity-50"
                    >
                      <Link2 className="w-3.5 h-3.5" /> {claimingId === c.id ? "..." : "Привязать"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
