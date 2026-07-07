// app/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider"; 
import { supabase } from "@/lib/supabase";
import { LogOut, Dumbbell, Calendar, ShieldAlert, User, Sliders } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { Card, Button, Input } from "@/components/ui/myo";

interface ClientProfile {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  height?: number | null;
  weight?: number | null;
}

export default function RootPage() {
  const authContext = useAuth();
  const user = authContext?.user;
  const profile = authContext?.profile; // ИСПРАВЛЕНО: убрана деструктуризация несуществующего свойства role
  const loading = authContext?.loading;
  const router = useRouter();

  const isTrainer = profile?.role === "trainer";

  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "config">("dashboard");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClientsLoading, setIsClientsLoading] = useState(false);
  const [selectedClientForConfig, setSelectedClientForConfig] = useState<ClientProfile | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const fetchClients = useCallback(async (trainerId: string) => {
    setIsClientsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, height, weight")
        .eq("role", "client")
        .eq("trainer_id", trainerId);
      
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error("Ошибка синхронизации списка атлетов:", err);
    } finally {
      setIsClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id && isTrainer) {
      fetchClients(user.id);
    }
  }, [user, isTrainer, fetchClients]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const filteredClients = clients.filter((c) =>
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center font-mono space-y-2">
        <div className="h-4 w-4 border-2 border-[#00E676] border-t-transparent animate-spin" />
        <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Инициализация интерфейса...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased pb-24">
      <Toaster />
      <header className="border-b border-[#141519] bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-50 p-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="text-sm font-black text-white tracking-widest uppercase">
            MYO <span className="text-[#00E676]">{isTrainer ? "ПРО-ТРЕНЕР" : "АТЛЕТ"}</span> 
          </span>
          <Button variant="danger" className="p-2 h-7 w-7" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4 space-y-6">
        <div className="space-y-2">
          <span className="text-[8px] font-black tracking-widest text-[#989AA0] uppercase block">Управление атлетами</span>
          <Input 
            placeholder="Поиск..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          <div className="space-y-2">
            {filteredClients.map((client) => (
              <Card key={client.id} className="p-4 bg-[#141519]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase">{client.full_name || "Без имени"}</span>
                  <Button variant="primary" className="!text-[7px] h-6 px-2 font-black">Настроить план</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}