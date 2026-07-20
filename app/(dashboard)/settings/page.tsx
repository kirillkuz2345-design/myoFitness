// app/(dashboard)/settings/page.tsx
"use client";

import React, { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface ProfileFormState {
  full_name: string;
  avatar_url: string;
  height_cm: string;
  weight_kg: string;
}

export default function SettingsPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [form, setForm] = useState<ProfileFormState>({
    full_name: profile?.full_name || "",
    avatar_url: profile?.avatar_url || "",
    height_cm: "",
    weight_kg: ""
  });

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("ИЗМЕНЕНИЯ УСПЕШНО СОХРАНЕНЫ");
    } catch {
      toast.error("СБОЙ СОХРАНЕНИЯ");
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono p-4">ЗАГРУЗКА...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased pb-28">
      <header className="border-b border-[#262626] bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <button type="button" onClick={() => router.push("/")} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#989AA0] hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" /> НАЗАД
          </button>
          <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">НАСТРОЙКИ</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <FormField label="ПОЛНОЕ ИМЯ" id="full_name">
          <input id="full_name" type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputClass} />
        </FormField>
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={isSavingProfile}
          className="w-full bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
        >
          {isSavingProfile ? "СОХРАНЕНИЕ..." : "СОХРАНИТЬ"}
        </button>
      </main>
    </div>
  );
}

const inputClass = "w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-4 py-3 text-xs text-white outline-none";

function FormField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">{label}</label>
      {children}
    </div>
  );
}
