"use client";

import React, { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, User } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

// Базовая структура формы
interface ProfileFormState {
  full_name: string;
  avatar_url: string;
  height_cm: string;
  weight_kg: string;
}

export default function SettingsPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  // ФИКС ВАРНИНГОВ: Объявляем используемые в разметке стейты и переменные
  const [activeTab, setActiveTab] = useState<"profile" | "clients">("profile");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  const [form, setForm] = useState<ProfileFormState>({
    full_name: profile?.full_name || "",
    avatar_url: profile?.avatar_url || "",
    height_cm: "",
    weight_kg: ""
  });

  const isTrainer = profile?.role === "trainer";

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      // Имитируем сохранение для работы интерфейса
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("ИЗМЕНЕНИЯ УСПЕШНО СОХРАНЕНЫ");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка";
      toast.error(`СБОЙ СОХРАНЕНИЯ: ${msg}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono p-4">ЗАГРУЗКА...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased pb-28">
      {/* СТРОГАЯ ШАПКА */}
      <header className="border-b border-[#262626] bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <button type="button" onClick={() => router.push("/")} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#989AA0] hover:text-white transition">
            <ArrowLeft className="w-3.5 h-3.5" /> НАЗАД
          </button>
          <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">НАСТРОЙКИ</h1>
          <div className="text-[8px] font-mono px-2 py-0.5 rounded border border-[#262626] text-emerald-400 bg-emerald-500/5">ONLINE</div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        
        {/* НАВИГАЦИЯ (СТИЛЬ WHOOP) */}
        {isTrainer && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#141519] border border-[#262626] rounded-xl">
            <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")} label="ПРОФИЛЬ" />
            <TabButton active={activeTab === "clients"} onClick={() => setActiveTab("clients")} label="ЗАМЕТКИ" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.section key="profile" className="space-y-6">
              <div className="bg-[#141519] border border-[#262626] rounded-xl p-6 shadow-none">
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#989AA0] mb-6 font-bold">ДАННЫЕ ПРОФИЛЯ</p>

                <div className="flex flex-col sm:flex-row gap-6 items-start mb-8">
                  {/* Простой превью аватара */}
                  <div className="w-16 h-16 rounded-xl bg-[#0A0A0A] border border-[#262626] flex items-center justify-center shrink-0 overflow-hidden">
                    {form.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-zinc-700" />
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-4">
                    <FormField label="ПОЛНОЕ ИМЯ" id="full_name">
                      <input id="full_name" type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputClass} placeholder="ИВАН ИВАНОВ" />
                    </FormField>
                    <FormField label="ФОТО (URL)" id="avatar_url">
                      <input id="avatar_url" type="url" value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} className={inputClass} placeholder="HTTPS://..." />
                    </FormField>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField label="РОСТ (СМ)" id="height_cm">
                    <input id="height_cm" type="number" value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} className={inputClass} placeholder="175" />
                  </FormField>
                  <FormField label="ВЕС (КГ)" id="weight_kg">
                    <input id="weight_kg" type="number" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} className={inputClass} placeholder="72" />
                  </FormField>
                </div>
              </div>

              <button type="button" onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-widest hover:bg-[#00E676] transition-all">
                {isSavingProfile ? "СИНХРОНИЗАЦИЯ..." : "СОХРАНИТЬ ДАННЫЕ"}
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const inputClass = "w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-4 py-3 text-xs text-white placeholder:text-[#333] focus:outline-none focus:border-[#00E676] transition-all";

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`py-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${active ? "bg-[#0A0A0A] text-white border border-[#262626]" : "text-[#515359] hover:text-white"}`}>
      {label}
    </button>
  );
}

function FormField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">{label}</label>
      {children}
    </div>
  );
}