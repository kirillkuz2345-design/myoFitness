"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { User, Search, Plus, ArrowRight, Dumbbell, Calendar, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

// Наша дизайн-система
import { Card, Button, Input } from "@/components/ui/myo";

const supabase = getSupabaseClient();

interface ClientProfile {
  id: string;
  full_name: string | null;
  email?: string;
  avatar_url?: string | null;
}

export default function TrainerClientsPage() {
  const authContext = useAuth();
  const user = authContext?.user;
  const profile = authContext?.profile;
  const loading = authContext?.loading;
  const router = useRouter();

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchClients = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("role", "client")
        .eq("trainer_id", userId);

      if (error) throw error;
      return data || [];
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error(`ОШИБКА ЗАГРУЗКИ АТЛЕТОВ: ${errorMessage}`);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!loading && profile && profile.role !== "trainer") {
      router.replace("/");
    }
  }, [profile, loading, router]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!user?.id) {
        if (!loading && !user) setIsLoading(false);
        return;
      }
      
      const data = await fetchClients(user.id);
      
      if (isMounted) {
        setClients(data);
        setIsLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [user, loading, fetchClients]);

  const filteredClients = clients.filter((c) =>
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="h-4 w-4 border-2 border-[#00E676] border-t-transparent animate-spin" />
        <p className="text-[#989AA0] text-[9px] tracking-widest uppercase">ЗАГРУЗКА БАЗЫ АТЛЕТОВ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased pb-12">
      <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#222328] pb-4">
          <div>
            <h1 className="text-xs font-black text-white tracking-widest uppercase">АККАУНТЫ АТЛЕТОВ</h1>
            <p className="text-[8px] text-[#989AA0] uppercase tracking-wider mt-0.5">УПРАВЛЕНИЕ И МОНИТОРИНГ КОНТИНГЕНТА</p>
          </div>
          <Button variant="primary" className="!text-[8px] h-7 px-3" onClick={() => router.push("/")}>
            <Plus className="w-3 h-3" /> ИНВАЙТ
          </Button>
        </div>

        <div className="relative">
          <Input 
            placeholder="ПОИСК АТЛЕТА ПО ИМЕНИ / ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-[#515359]" />
        </div>

        <div className="space-y-2">
          {filteredClients.length === 0 ? (
            <div className="border border-dashed border-[#222328] bg-[#141519]/20 rounded-xl p-8 text-center space-y-2">
              <ShieldAlert className="h-5 w-5 text-zinc-600 mx-auto" />
              <p className="text-[10px] text-[#989AA0] uppercase tracking-wider">АТЛЕТЫ НЕ ОБНАРУЖЕНЫ</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <Card key={client.id} className="p-0 overflow-hidden group hover:border-[#00E676]/40 transition-all cursor-pointer">
                <div 
                  className="p-3.5 flex items-center justify-between w-full h-full"
                  onClick={() => router.push(`/trainer/clients/${client.id}`)}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-8 h-8 rounded bg-[#0A0A0A] border border-[#222328] flex items-center justify-center text-zinc-500 text-xs font-bold group-hover:border-[#00E676]/30 transition-colors">
                      <User className="h-4 w-4 text-[#515359] group-hover:text-[#00E676] transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wide transition-colors group-hover:text-[#00E676]">
                        {client.full_name || "НЕИДЕНТИФИЦИРОВАН"}
                      </h3>
                      <div className="flex items-center space-x-2 mt-0.5 text-[8px] text-[#989AA0] font-bold uppercase tracking-wider">
                        <span className="text-[#00E676]">● АКТИВЕН</span>
                        <span className="text-zinc-700">•</span>
                        <span>ID: {client.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <div className="p-1 bg-[#0A0A0A] border border-[#222328] rounded text-zinc-500">
                        <Dumbbell className="w-2.5 h-2.5" />
                      </div>
                      <div className="p-1 bg-[#0A0A0A] border border-[#222328] rounded text-zinc-500">
                        <Calendar className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}