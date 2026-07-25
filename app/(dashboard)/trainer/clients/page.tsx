// app/(dashboard)/trainer/clients/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Users, Sliders } from "lucide-react";
import { Card, Button, Input } from "@/components/ui/myo";

interface ClientProfile {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  height?: number | null;
  weight?: number | null;
}

export default function TrainerClientsListPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // Инициализируем true, чтобы не вызывать setState синхронно внутри эффекта
  // (react-hooks/set-state-in-effect). Флаг гасится в callback после await.
  const [isClientsLoading, setIsClientsLoading] = useState(true);

  // Функция загрузки атлетов: только возвращает данные, без setState —
  // чтобы setState жил в callback эффекта (.then), как требует react-hooks/set-state-in-effect.
  const fetchClients = useCallback(async (trainerId: string): Promise<ClientProfile[] | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, height, weight")
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
    // setState внутри callback — разрешённый правилом паттерн.
    fetchClients(user.id).then((data) => {
      if (cancelled) return;
      if (data) setClients(data);
      setIsClientsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, profile, loading, router, fetchClients]);

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
      <div className="flex items-center space-x-2">
        <Users className="h-4 w-4 text-[#00E676]" />
        <span className="text-[10px] font-black tracking-widest text-[#989AA0] uppercase block">
          Управление атлетами ({filteredClients.length})
        </span>
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
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-black text-white uppercase block">
                    {client.full_name || "Атлет без имени"}
                  </span>
                  <div className="flex gap-3 text-[9px] text-[#989AA0] font-bold uppercase">
                    {client.weight && <span>Вес: {client.weight} кг</span>}
                    {client.height && <span>Рост: {client.height} см</span>}
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="!text-[9px] h-8 px-4 font-black"
                  onClick={() => router.push(`/trainer/clients/${client.id}`)}
                >
                  <Sliders className="w-3 h-3 mr-1" /> Разбор
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
