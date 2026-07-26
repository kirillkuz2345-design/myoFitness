// app/(dashboard)/trainer/payments/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Plus, X, Check, Trash2, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

interface ClientOption {
  id: string;
  full_name: string | null;
}

interface Payment {
  id: string;
  client_id: string;
  amount: number;
  due_date: string;
  status: "pending" | "paid";
  note: string | null;
}

interface PaymentsData {
  clients: ClientOption[];
  payments: Payment[];
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Bucket = "overdue" | "soon" | "later" | "paid";

function bucketOf(p: Payment, today: string, soonLimit: string): Bucket {
  if (p.status === "paid") return "paid";
  if (p.due_date < today) return "overdue";
  if (p.due_date <= soonLimit) return "soon";
  return "later";
}

export default function TrainerPaymentsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fetching, setFetching] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pClient, setPClient] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pDue, setPDue] = useState(() => ymd(new Date()));
  const [pNote, setPNote] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || profile?.role?.toUpperCase() !== "TRAINER")) {
      router.replace("/login");
    }
  }, [authLoading, user, profile, router]);

  const loadData = useCallback(async (): Promise<PaymentsData | null> => {
    if (!user?.id) return null;
    try {
      const [cRes, pRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("role", "client").eq("trainer_id", user.id),
        supabase
          .from("payments")
          .select("id, client_id, amount, due_date, status, note")
          .eq("trainer_id", user.id)
          .order("due_date", { ascending: true }),
      ]);
      if (cRes.error) throw cRes.error;
      if (pRes.error) throw pRes.error;
      return {
        clients: (cRes.data as ClientOption[]) ?? [],
        payments: (pRes.data as Payment[]) ?? [],
      };
    } catch (err) {
      console.error("Ошибка загрузки оплат:", err);
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    loadData().then((data) => {
      if (cancelled) return;
      if (data) {
        setClients(data.clients);
        setPayments(data.payments);
        setPClient((prev) => prev || data.clients[0]?.id || "");
      }
      setFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadData, user]);

  const refresh = async () => {
    const data = await loadData();
    if (data) {
      setClients(data.clients);
      setPayments(data.payments);
    }
  };

  const nameOf = (id: string) => clients.find((c) => c.id === id)?.full_name || "Атлет";

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pClient || pAmount === "" || isNaN(Number(pAmount)) || !pDue) {
      toast.error("Заполните атлета, сумму и дату");
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("payments").insert([
        {
          trainer_id: user.id,
          client_id: pClient,
          amount: Number(pAmount),
          due_date: pDue,
          note: pNote.trim() || null,
        },
      ]);
      if (error) throw error;
      setPAmount("");
      setPNote("");
      setShowAdd(false);
      await refresh();
      toast.success("Платёж добавлен");
    } catch (err) {
      console.error("Ошибка добавления платежа:", err);
      toast.error("Не удалось добавить платёж");
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async (p: Payment) => {
    const next = p.status === "paid" ? "pending" : "paid";
    setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
    const { error } = await supabase
      .from("payments")
      .update({ status: next, paid_at: next === "paid" ? new Date().toISOString() : null })
      .eq("id", p.id);
    if (error) {
      console.error("Ошибка обновления статуса:", error);
      toast.error("Не удалось обновить");
      setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: p.status } : x)));
    }
  };

  const removePayment = async (id: string) => {
    const prev = payments;
    setPayments((cur) => cur.filter((x) => x.id !== id));
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) {
      console.error("Ошибка удаления:", error);
      toast.error("Не удалось удалить");
      setPayments(prev);
    }
  };

  const today = ymd(new Date());
  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 7);
  const soonLimit = ymd(soonDate);

  const overdue = payments.filter((p) => bucketOf(p, today, soonLimit) === "overdue");
  const overdueSum = overdue.reduce((s, p) => s + Number(p.amount), 0);
  const soonCount = payments.filter((p) => bucketOf(p, today, soonLimit) === "soon").length;

  // сортировка: pending раньше paid, внутри — по дате
  const sorted = [...payments].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return a.due_date.localeCompare(b.due_date);
  });

  const badge = (p: Payment) => {
    const b = bucketOf(p, today, soonLimit);
    if (b === "paid")
      return (
        <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-[#00E676]">
          <CheckCircle2 className="w-3 h-3" /> Оплачено
        </span>
      );
    if (b === "overdue")
      return (
        <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-rose-500">
          <AlertTriangle className="w-3 h-3" /> Просрочено
        </span>
      );
    if (b === "soon")
      return (
        <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-amber-400">
          <Clock className="w-3 h-3" /> Скоро
        </span>
      );
    return <span className="text-[8px] font-bold uppercase text-[#989AA0]">Ожидает</span>;
  };

  const inputCls =
    "w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]";

  return (
    <div className="space-y-5">
      {/* Сводка */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-1">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-rose-500">Просрочено</span>
          <div className="text-2xl font-black text-white">{fetching ? "…" : overdueSum}</div>
          <span className="text-[9px] text-[#989AA0]">{overdue.length} платежей</span>
        </div>
        <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-1">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-amber-400">Скоро (7 дней)</span>
          <div className="text-2xl font-black text-white">{fetching ? "…" : soonCount}</div>
          <span className="text-[9px] text-[#989AA0]">платежей к оплате</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Платежи</h2>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
        >
          <Plus className="w-3 h-3" /> Платёж
        </button>
      </div>

      {fetching ? (
        <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-6 text-center">
          <span className="text-xs text-zinc-600 animate-pulse">Загрузка...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-[#1C1C1E] rounded-2xl text-[10px] text-zinc-600 uppercase">
          Платежей нет
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border bg-[#111214] p-3 flex items-center justify-between gap-3 ${
                bucketOf(p, today, soonLimit) === "overdue" ? "border-rose-900/50" : "border-[#1C1C1E]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">{nameOf(p.client_id)}</span>
                  {badge(p)}
                </div>
                <div className="text-[9px] text-[#989AA0] mt-0.5">
                  до {p.due_date}
                  {p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
              <span className="text-sm font-black text-white shrink-0">{p.amount}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => togglePaid(p)}
                  aria-label="Отметить оплату"
                  className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
                    p.status === "paid"
                      ? "border-[#00E676] text-[#00E676]"
                      : "border-[#262626] text-[#989AA0] hover:text-white"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removePayment(p.id)}
                  aria-label="Удалить"
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-[#262626] text-zinc-600 hover:text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка: новый платёж */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Новый платёж</h3>
              <button type="button" onClick={() => setShowAdd(false)} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Атлет</label>
                <select value={pClient} onChange={(e) => setPClient(e.target.value)} className={inputCls}>
                  {clients.length === 0 && <option value="">Нет атлетов</option>}
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || "Атлет без имени"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Сумма</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pAmount}
                    onChange={(e) => setPAmount(e.target.value)}
                    placeholder="3000"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Срок</label>
                  <input type="date" value={pDue} onChange={(e) => setPDue(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Комментарий</label>
                <input
                  value={pNote}
                  onChange={(e) => setPNote(e.target.value)}
                  placeholder="Абонемент, 8 занятий…"
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#00E676] text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {saving ? "Сохранение..." : "Добавить платёж"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
