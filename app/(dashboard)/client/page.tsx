// app/(dashboard)/client/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  Settings,
  Plus,
  X,
  ChevronRight,
  LayoutGrid,
  CalendarDays,
  MessageSquare,
  LogOut,
  type LucideIcon,
} from "lucide-react";

// ── Типы ─────────────────────────────────────────────────────
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
  metric_type: string; // = MetricConfig.id
  value: number;
  recorded_at: string;
}

interface DashboardData {
  configs: MetricConfig[];
  metrics: MetricEntry[];
}

const PALETTE = ["#00E676", "#3A86FF", "#8B5CF6", "#FF007F", "#FFB020"];

// ── Загрузка (без setState — паттерн для react-hooks/set-state-in-effect) ──
async function loadDashboard(): Promise<DashboardData | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [configsRes, metricsRes] = await Promise.all([
      supabase
        .from("client_metric_configs")
        .select("id, label, unit, display_type, target, color, position")
        .eq("client_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("client_metrics")
        .select("id, metric_type, value, recorded_at")
        .eq("client_id", user.id)
        .order("recorded_at", { ascending: true }),
    ]);

    if (configsRes.error) throw configsRes.error;
    if (metricsRes.error) throw metricsRes.error;

    return {
      configs: (configsRes.data ?? []) as MetricConfig[],
      metrics: (metricsRes.data ?? []) as MetricEntry[],
    };
  } catch (err) {
    console.error("Ошибка загрузки дашборда:", err);
    return null;
  }
}

// ── Кольцо прогресса ─────────────────────────────────────────
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
      <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
        {display}
      </span>
    </div>
  );
}

// ── Мини-график тренда ───────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Навигация ────────────────────────────────────────────────
interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  action?: "logout";
}

const NAV: NavItem[] = [
  { key: "cabinet", label: "Кабинет", icon: LayoutGrid, href: "/client" },
  { key: "schedule", label: "Расписание", icon: CalendarDays, href: "/history" },
  { key: "chat", label: "Чат", icon: MessageSquare, href: "/chat" },
  { key: "settings", label: "Настройки", icon: Settings, href: "/settings" },
  { key: "logout", label: "Выход", icon: LogOut, href: "/login", action: "logout" },
];

export default function ClientDashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [configs, setConfigs] = useState<MetricConfig[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [fetching, setFetching] = useState<boolean>(true);

  // Модалка нового показателя
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [cfgLabel, setCfgLabel] = useState("");
  const [cfgUnit, setCfgUnit] = useState("");
  const [cfgType, setCfgType] = useState<DisplayType>("trend");
  const [cfgTarget, setCfgTarget] = useState("");
  const [cfgColor, setCfgColor] = useState(PALETTE[0]);
  const [savingCfg, setSavingCfg] = useState(false);

  // Модалка внесения замера
  const [valueForConfig, setValueForConfig] = useState<MetricConfig | null>(null);
  const [valInput, setValInput] = useState("");
  const [valDate, setValDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [savingVal, setSavingVal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((data) => {
      if (cancelled) return;
      if (data) {
        setConfigs(data.configs);
        setMetrics(data.metrics);
      }
      setFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    const data = await loadDashboard();
    if (data) {
      setConfigs(data.configs);
      setMetrics(data.metrics);
    }
  };

  const handleNav = async (item: NavItem) => {
    if (item.action === "logout") {
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }
    router.push(item.href);
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgLabel.trim()) return;
    setSavingCfg(true);
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) return;
      const target = cfgType === "ring" && cfgTarget ? Number(cfgTarget) : null;
      const { error } = await supabase.from("client_metric_configs").insert([
        {
          client_id: u.id,
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
    if (!valueForConfig || valInput === "" || isNaN(Number(valInput))) return;
    setSavingVal(true);
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) return;
      const { error } = await supabase.from("client_metrics").insert([
        {
          client_id: u.id,
          metric_type: valueForConfig.id,
          value: Number(valInput),
          recorded_at: valDate,
        },
      ]);
      if (error) throw error;
      setValInput("");
      setValueForConfig(null);
      await refresh();
    } catch (err) {
      console.error("Ошибка внесения замера:", err);
    } finally {
      setSavingVal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center font-mono">
        <span className="text-xs text-zinc-500 uppercase tracking-widest animate-pulse">
          Загрузка кабинета...
        </span>
      </div>
    );
  }

  const displayName = profile?.full_name || user?.email || "Атлет";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased pb-24">
      {/* Шапка */}
      <header className="sticky top-0 z-40 border-b border-[#1C1C1E] bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="mx-auto max-w-md px-5 h-16 flex items-center justify-between">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
            NAORE <span className="text-[#00E676]">FITNESS</span>
          </h1>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            aria-label="Настройки"
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#262626] bg-[#111214] text-[#989AA0] hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-6">
        {/* Показатели */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">
              {displayName} · Показатели
            </h2>
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
              <span className="text-xs text-zinc-600 animate-pulse">Загрузка показателей...</span>
            </div>
          ) : configs.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="w-full rounded-2xl border border-dashed border-[#262626] bg-[#111214]/40 p-6 text-center hover:border-[#00E676]/50 transition-colors"
            >
              <Plus className="w-5 h-5 mx-auto mb-2 text-zinc-600" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                Добавьте свой первый показатель:<br />сон, посещаемость, результат, вес…
              </p>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {configs.map((cfg) => {
                const series = metrics
                  .filter((m) => m.metric_type === cfg.id)
                  .map((m) => m.value);
                const latest = series.length ? series[series.length - 1] : null;
                const percent =
                  cfg.display_type === "ring" && cfg.target && cfg.target > 0 && latest !== null
                    ? (latest / cfg.target) * 100
                    : 0;

                return (
                  <div
                    key={cfg.id}
                    className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-3 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#989AA0] leading-tight">
                        {cfg.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setValueForConfig(cfg);
                          setValInput("");
                          setValDate(new Date().toISOString().split("T")[0]);
                        }}
                        aria-label="Внести замер"
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
                          display={
                            latest === null
                              ? "—"
                              : cfg.target
                                ? `${Math.round(percent)}%`
                                : String(latest)
                          }
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white">
                            {latest === null ? "—" : latest}
                          </span>
                          {cfg.unit && (
                            <span className="text-[10px] font-bold text-[#989AA0]">{cfg.unit}</span>
                          )}
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

        {/* CTA */}
        <button
          type="button"
          onClick={() => router.push("/client/workouts")}
          className="w-full bg-[#00E676] text-black font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.15em] hover:bg-[#00c765] transition-colors"
        >
          Создать персональную тренировку
        </button>

        {/* От тренера */}
        <section className="space-y-3">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0]">От тренера</h2>
          <button
            type="button"
            onClick={() => router.push("/client/workouts")}
            className="w-full flex items-center gap-3 rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 text-left hover:border-[#262626] transition-colors"
          >
            <div className="h-11 w-11 shrink-0 rounded-full bg-[#1C1C1E] flex items-center justify-center text-[10px] font-black text-[#00E676]">
              А
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Верх тела · сила</p>
              <p className="text-[9px] font-bold text-[#989AA0] uppercase tracking-wider mt-0.5">
                Тренер Алексей · 45 мин
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#989AA0] shrink-0" />
          </button>
        </section>
      </main>

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
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                  Название
                </label>
                <input
                  value={cfgLabel}
                  onChange={(e) => setCfgLabel(e.target.value)}
                  placeholder="Сон, Посещаемость, Жим лёжа…"
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Единица
                  </label>
                  <input
                    value={cfgUnit}
                    onChange={(e) => setCfgUnit(e.target.value)}
                    placeholder="ч, %, кг, раз"
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Вид
                  </label>
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
                  <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                    Цель (для %)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={cfgTarget}
                    onChange={(e) => setCfgTarget(e.target.value)}
                    placeholder="Например: 8"
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                  Цвет
                </label>
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

      {/* Модалка: внести замер */}
      {valueForConfig && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">
                {valueForConfig.label}
              </h3>
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
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">
                  Дата
                </label>
                <input
                  type="date"
                  value={valDate}
                  onChange={(e) => setValDate(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]"
                />
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

      {/* Нижняя навигация */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[#1C1C1E] bg-[#0A0A0A]/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-2 h-16 flex items-center justify-between">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.action !== "logout" && pathname === item.href;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNav(item)}
                className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${
                  active ? "text-[#00E676]" : "text-[#989AA0] hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8px] font-bold uppercase tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
