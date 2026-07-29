// app/(dashboard)/trainer/analytics/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Plus, X, Users, Dumbbell, Activity, TrendingUp, Copy, Link2 } from "lucide-react";

type DisplayType = "ring" | "trend";

interface MetricConfig {
  id: string;
  label: string;
  unit: string;
  display_type: DisplayType;
  target: number | null;
  color: string;
  position: number;
}

interface MetricEntry {
  id: string;
  metric_type: string;
  value: number;
  recorded_at: string;
}

interface Summary {
  clients: number;
  workouts30: number;
  active30: number;
}

interface AnalyticsData {
  summary: Summary;
  configs: MetricConfig[];
  values: MetricEntry[];
}

const PALETTE = ["#00E676", "#3A86FF", "#8B5CF6", "#FF007F", "#FFB020"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadAnalytics(trainerId: string): Promise<AnalyticsData | null> {
  try {
    // 1. Атлеты тренера
    const { data: clientsData, error: cErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "client")
      .eq("trainer_id", trainerId);
    if (cErr) throw cErr;
    const clientIds = (clientsData ?? []).map((c) => c.id as string);

    // 2. Тренировки за 30 дней среди этих атлетов
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    let workouts30 = 0;
    let active30 = 0;
    if (clientIds.length > 0) {
      const { data: wData, error: wErr } = await supabase
        .from("workouts")
        .select("client_id, workout_date")
        .in("client_id", clientIds)
        .gte("workout_date", ymd(cutoff));
      if (wErr) throw wErr;
      workouts30 = wData?.length ?? 0;
      active30 = new Set((wData ?? []).map((w) => w.client_id as string)).size;
    }

    // 3. Произвольные метрики тренера
    const [cfgRes, valRes] = await Promise.all([
      supabase
        .from("trainer_metric_configs")
        .select("id, label, unit, display_type, target, color, position")
        .eq("trainer_id", trainerId)
        .order("position", { ascending: true }),
      supabase
        .from("trainer_metrics")
        .select("id, metric_type, value, recorded_at")
        .eq("trainer_id", trainerId)
        .order("recorded_at", { ascending: true }),
    ]);
    if (cfgRes.error) throw cfgRes.error;
    if (valRes.error) throw valRes.error;

    return {
      summary: { clients: clientIds.length, workouts30, active30 },
      configs: (cfgRes.data as MetricConfig[]) ?? [],
      values: (valRes.data as MetricEntry[]) ?? [],
    };
  } catch (err) {
    console.error("Ошибка загрузки аналитики:", err);
    return null;
  }
}

function ProgressRing({ percent, color, display }: { percent: number; color: string; display: string }) {
  const size = 72;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1C1C1E" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">{display}</span>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TrainerAnalyticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<Summary>({ clients: 0, workouts30: 0, active30: 0 });
  const [configs, setConfigs] = useState<MetricConfig[]>([]);
  const [values, setValues] = useState<MetricEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [cfgLabel, setCfgLabel] = useState("");
  const [cfgUnit, setCfgUnit] = useState("");
  const [cfgType, setCfgType] = useState<DisplayType>("trend");
  const [cfgTarget, setCfgTarget] = useState("");
  const [cfgColor, setCfgColor] = useState(PALETTE[0]);
  const [savingCfg, setSavingCfg] = useState(false);

  const [valueForConfig, setValueForConfig] = useState<MetricConfig | null>(null);
  const [valInput, setValInput] = useState("");
  const [valDate, setValDate] = useState(() => ymd(new Date()));
  const [savingVal, setSavingVal] = useState(false);

  // Не выкидываем, пока профиль ещё грузится (иначе F5 сбрасывает на /login)
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    if (!authLoading && profile && profile.role?.toUpperCase() !== "TRAINER") {
      router.replace("/login");
    }
  }, [authLoading, user, profile, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    loadAnalytics(user.id).then((data) => {
      if (cancelled || !data) {
        if (!cancelled) setFetching(false);
        return;
      }
      setSummary(data.summary);
      setConfigs(data.configs);
      setValues(data.values);
      setFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = async () => {
    if (!user?.id) return;
    const data = await loadAnalytics(user.id);
    if (data) {
      setSummary(data.summary);
      setConfigs(data.configs);
      setValues(data.values);
    }
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgLabel.trim() || !user?.id) return;
    setSavingCfg(true);
    try {
      const target = cfgType === "ring" && cfgTarget ? Number(cfgTarget) : null;
      const { error } = await supabase.from("trainer_metric_configs").insert([
        {
          trainer_id: user.id,
          label: cfgLabel.trim(),
          unit: cfgUnit.trim(),
          display_type: cfgType,
          target,
          color: cfgColor,
          position: configs.length,
        },
      ]);
      if (error) throw error;
      setCfgLabel("");
      setCfgUnit("");
      setCfgTarget("");
      setCfgType("trend");
      setCfgColor(PALETTE[0]);
      setShowConfigModal(false);
      await refresh();
    } catch (err) {
      console.error("Ошибка создания показателя:", err);
    } finally {
      setSavingCfg(false);
    }
  };

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valueForConfig || valInput === "" || isNaN(Number(valInput)) || !user?.id) return;
    setSavingVal(true);
    try {
      const { error } = await supabase.from("trainer_metrics").insert([
        { trainer_id: user.id, metric_type: valueForConfig.id, value: Number(valInput), recorded_at: valDate },
      ]);
      if (error) throw error;
      setValInput("");
      setValueForConfig(null);
      await refresh();
    } catch (err) {
      console.error("Ошибка внесения значения:", err);
    } finally {
      setSavingVal(false);
    }
  };

  const copyInvite = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${user.id}`);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const avgPerClient = summary.clients > 0 ? (summary.workouts30 / summary.clients).toFixed(1) : "0";

  const summaryCards = [
    { key: "clients", label: "Атлетов", value: String(summary.clients), icon: Users },
    { key: "workouts", label: "Тренировок · 30д", value: String(summary.workouts30), icon: Dumbbell },
    { key: "active", label: "Активных · 30д", value: String(summary.active30), icon: Activity },
    { key: "avg", label: "Ср. на атлета", value: avgPerClient, icon: TrendingUp },
  ];

  const inputCls =
    "w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]";

  return (
    <div className="space-y-6">
      {/* Сводка */}
      <section className="space-y-3">
        <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Сводка</h2>
        <div className="grid grid-cols-2 gap-3">
          {summaryCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.key} className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-[#989AA0]">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-bold uppercase tracking-[0.15em]">{c.label}</span>
                </div>
                <span className="text-2xl font-black text-white">{fetching ? "…" : c.value}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Произвольные метрики */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Мои показатели</h2>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#00E676] hover:text-[#00c765]"
          >
            <Plus className="w-3 h-3" /> Показатель
          </button>
        </div>

        {fetching ? (
          <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-6 text-center">
            <span className="text-xs text-zinc-600 animate-pulse">Загрузка...</span>
          </div>
        ) : configs.length === 0 ? (
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="w-full rounded-2xl border border-dashed border-[#262626] bg-[#111214]/40 p-6 text-center hover:border-[#00E676]/50 transition-colors"
          >
            <Plus className="w-5 h-5 mx-auto mb-2 text-zinc-600" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
              Добавьте показатель: возвращаемость,<br />рабочие часы, доход…
            </p>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {configs.map((cfg) => {
              const series = values.filter((m) => m.metric_type === cfg.id).map((m) => m.value);
              const latest = series.length ? series[series.length - 1] : null;
              const percent =
                cfg.display_type === "ring" && cfg.target && cfg.target > 0 && latest !== null
                  ? (latest / cfg.target) * 100
                  : 0;
              return (
                <div key={cfg.id} className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-3 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#989AA0] leading-tight">
                      {cfg.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setValueForConfig(cfg);
                        setValInput("");
                        setValDate(ymd(new Date()));
                      }}
                      aria-label="Внести значение"
                      className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md border border-[#262626] text-[#989AA0] hover:text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {cfg.display_type === "ring" ? (
                    <div className="flex justify-center py-1">
                      <ProgressRing
                        percent={percent}
                        color={cfg.color}
                        display={latest === null ? "—" : cfg.target ? `${Math.round(percent)}%` : String(latest)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white">{latest === null ? "—" : latest}</span>
                        {cfg.unit && <span className="text-[10px] font-bold text-[#989AA0]">{cfg.unit}</span>}
                      </div>
                      <Sparkline values={series} color={cfg.color} />
                    </div>
                  )}

                  {cfg.display_type === "ring" && cfg.target && (
                    <span className="text-center text-[8px] font-bold text-[#989AA0]">
                      цель {cfg.target} {cfg.unit}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Персональная ссылка-приглашение */}
      <section className="space-y-3">
        <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">Ссылка-приглашение</h2>
        <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
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
          <p className="text-[8px] text-zinc-600 uppercase tracking-wider">
            Отправь атлету — по ней он привяжется к тебе.
          </p>
        </div>
      </section>

      {/* Модалка: новый показатель */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Новый показатель</h3>
              <button type="button" onClick={() => setShowConfigModal(false)} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>
            <form onSubmit={handleCreateConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Название</label>
                <input
                  value={cfgLabel}
                  onChange={(e) => setCfgLabel(e.target.value)}
                  placeholder="Возвращаемость, Рабочие часы…"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Единица</label>
                  <input value={cfgUnit} onChange={(e) => setCfgUnit(e.target.value)} placeholder="%, ч, ₽" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Вид</label>
                  <div className="grid grid-cols-2 gap-1 bg-[#0A0A0A] border border-[#262626] rounded-lg p-1">
                    {(["trend", "ring"] as DisplayType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCfgType(t)}
                        className={`py-1.5 rounded-md text-[8px] font-bold uppercase tracking-wider transition-colors ${
                          cfgType === t ? "bg-[#00E676] text-black" : "text-[#989AA0]"
                        }`}
                      >
                        {t === "trend" ? "Число" : "Кольцо"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {cfgType === "ring" && (
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Цель (для %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cfgTarget}
                    onChange={(e) => setCfgTarget(e.target.value)}
                    placeholder="Например: 90"
                    className={inputCls}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Цвет</label>
                <div className="flex gap-2">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCfgColor(c)}
                      aria-label={`Цвет ${c}`}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${
                        cfgColor === c ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={savingCfg}
                className="w-full bg-white text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {savingCfg ? "Создание..." : "Создать показатель"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: внести значение */}
      {valueForConfig && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">{valueForConfig.label}</h3>
              <button type="button" onClick={() => setValueForConfig(null)} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>
            <form onSubmit={handleAddValue} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                  Значение {valueForConfig.unit && `(${valueForConfig.unit})`}
                </label>
                <input
                  type="number"
                  step="0.1"
                  autoFocus
                  value={valInput}
                  onChange={(e) => setValInput(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Дата</label>
                <input type="date" value={valDate} onChange={(e) => setValDate(e.target.value)} className={inputCls} />
              </div>
              <button
                type="submit"
                disabled={savingVal}
                className="w-full bg-[#00E676] text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {savingVal ? "Сохранение..." : "Зафиксировать"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
