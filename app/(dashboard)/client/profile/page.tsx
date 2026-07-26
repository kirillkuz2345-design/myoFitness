"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { User, Shield, Mail } from "lucide-react";

interface ProfileForm {
  full_name: string;
  goal: string;
  height: string;
  weight: string;
  birth_date: string;
  injuries: string;
}

const EMPTY: ProfileForm = {
  full_name: "",
  goal: "",
  height: "",
  weight: "",
  birth_date: "",
  injuries: "",
};

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"client" | "trainer">("client");
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        if (!cancelled) setEmail(user.email ?? "");

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, role, goal, height, weight, birth_date, injuries")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (data && !cancelled) {
          setRole(String(data.role).toLowerCase() === "trainer" ? "trainer" : "client");
          setForm({
            full_name: data.full_name ?? "",
            goal: data.goal ?? "",
            height: data.height != null ? String(data.height) : "",
            weight: data.weight != null ? String(data.weight) : "",
            birth_date: data.birth_date ?? "",
            injuries: data.injuries ?? "",
          });
        }
      } catch (err) {
        console.error("Ошибка при загрузке профиля:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (field: keyof ProfileForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || null,
          goal: form.goal.trim() || null,
          height: form.height.trim() === "" ? null : Number(form.height),
          weight: form.weight.trim() === "" ? null : Number(form.weight),
          birth_date: form.birth_date || null,
          injuries: form.injuries.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Анкета сохранена");
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-[#989AA0] uppercase tracking-widest animate-pulse">
        Синхронизация профиля с облаком...
      </div>
    );
  }

  const inputCls =
    "w-full bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676] transition-colors";

  return (
    <div className="space-y-4">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Профиль атлета</h2>

      {/* Учётные данные */}
      <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-5 space-y-3">
        <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#1C1C1E] rounded-lg">
          <span className="text-[#989AA0] flex items-center gap-1.5 text-xs">
            <Mail className="w-3.5 h-3.5 text-[#989AA0]" /> Email
          </span>
          <span className="text-gray-300 font-mono text-xs">{email || "—"}</span>
        </div>
        <div className="flex justify-between items-center bg-[#0A0A0A] p-3 border border-[#1C1C1E] rounded-lg">
          <span className="text-[#989AA0] flex items-center gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5 text-[#989AA0]" /> Доступ
          </span>
          <span
            className={`font-bold tracking-wider uppercase text-[10px] px-2 py-0.5 rounded ${
              role === "trainer"
                ? "bg-purple-950 text-purple-400 border border-purple-800"
                : "bg-[#0E2A1C] text-[#00E676] border border-[#16423C]"
            }`}
          >
            {role === "trainer" ? "Наставник" : "Спортсмен"}
          </span>
        </div>
      </div>

      {/* Анкета */}
      <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-5 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#00E676]" /> Анкета
        </h3>

        <Field label="Имя">
          <input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className={inputCls} />
        </Field>

        <Field label="Запрос / цель">
          <textarea
            value={form.goal}
            onChange={(e) => update("goal", e.target.value)}
            rows={2}
            placeholder="Похудеть, набрать массу, реабилитация…"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Рост, см">
            <input value={form.height} onChange={(e) => update("height", e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Вес, кг">
            <input value={form.weight} onChange={(e) => update("weight", e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Д. рождения">
            <input type="date" value={form.birth_date} onChange={(e) => update("birth_date", e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Травмы / ограничения">
          <textarea
            value={form.injuries}
            onChange={(e) => update("injuries", e.target.value)}
            rows={2}
            placeholder="Колено, спина, аллергии…"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#00E676] text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-[#00c765] transition-colors"
        >
          {saving ? "Сохранение..." : "Сохранить анкету"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">{label}</label>
      {children}
    </div>
  );
}
