// components/assistant/KbjuCalculator.tsx
"use client";

import React, { useState } from "react";
import { Sparkles, Plus, Trash2 } from "lucide-react";
import { parseGrams, parseNonNegative } from "@/lib/nutrition";

interface FoodPreset {
  name: string;
  kcal: number; // на 100 г
  p: number; // белки
  f: number; // жиры
  c: number; // углеводы
}

// Значения на 100 г продукта
const PRESETS: FoodPreset[] = [
  { name: "Куриная грудка", kcal: 165, p: 31, f: 3.6, c: 0 },
  { name: "Говядина", kcal: 250, p: 26, f: 15, c: 0 },
  { name: "Лосось", kcal: 208, p: 20, f: 13, c: 0 },
  { name: "Яйцо", kcal: 155, p: 13, f: 11, c: 1.1 },
  { name: "Творог 5%", kcal: 121, p: 17, f: 5, c: 3 },
  { name: "Молоко 2.5%", kcal: 52, p: 2.8, f: 2.5, c: 4.7 },
  { name: "Рис отварной", kcal: 130, p: 2.7, f: 0.3, c: 28 },
  { name: "Гречка отварная", kcal: 110, p: 4, f: 1.1, c: 20 },
  { name: "Овсянка (сухая)", kcal: 380, p: 12, f: 6, c: 65 },
  { name: "Макароны отварные", kcal: 130, p: 4, f: 1, c: 25 },
  { name: "Картофель отварной", kcal: 82, p: 2, f: 0.4, c: 17 },
  { name: "Хлеб", kcal: 265, p: 9, f: 3, c: 49 },
  { name: "Банан", kcal: 96, p: 1.5, f: 0.2, c: 21 },
  { name: "Яблоко", kcal: 52, p: 0.3, f: 0.2, c: 14 },
];

interface Item {
  id: string;
  name: string;
  grams: number;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

type ErrorField = "name" | "grams" | "macros";
type FormError = { field: ErrorField; msg: string } | null;

export default function KbjuCalculator() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<"preset" | "custom">("preset");

  const [presetIdx, setPresetIdx] = useState(0);
  const [grams, setGrams] = useState("100");

  // Ручной ввод (на 100 г)
  const [cName, setCName] = useState("");
  const [cKcal, setCKcal] = useState("");
  const [cP, setCP] = useState("");
  const [cF, setCF] = useState("");
  const [cC, setCC] = useState("");

  const [error, setError] = useState<FormError>(null);

  const switchMode = (m: "preset" | "custom") => {
    setMode(m);
    setError(null);
  };

  const addPreset = () => {
    const g = parseGrams(grams);
    if (g === null) {
      setError({ field: "grams", msg: "Укажите вес в граммах — положительное число." });
      return;
    }
    setError(null);
    const p = PRESETS[presetIdx];
    const factor = g / 100;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: p.name,
        grams: g,
        kcal: p.kcal * factor,
        p: p.p * factor,
        f: p.f * factor,
        c: p.c * factor,
      },
    ]);
    setGrams("100");
  };

  const addCustom = () => {
    if (!cName.trim()) {
      setError({ field: "name", msg: "Введите название продукта." });
      return;
    }
    const g = parseGrams(grams);
    if (g === null) {
      setError({ field: "grams", msg: "Укажите вес в граммах — положительное число." });
      return;
    }
    const kcal = parseNonNegative(cKcal);
    const p = parseNonNegative(cP);
    const f = parseNonNegative(cF);
    const c = parseNonNegative(cC);
    if (kcal === null || p === null || f === null || c === null) {
      setError({ field: "macros", msg: "КБЖУ должны быть неотрицательными числами." });
      return;
    }
    setError(null);
    const factor = g / 100;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: cName.trim(),
        grams: g,
        kcal: kcal * factor,
        p: p * factor,
        f: f * factor,
        c: c * factor,
      },
    ]);
    setCName("");
    setCKcal("");
    setCP("");
    setCF("");
    setCC("");
    setGrams("100");
  };

  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const totals = items.reduce(
    (acc, i) => ({ kcal: acc.kcal + i.kcal, p: acc.p + i.p, f: acc.f + i.f, c: acc.c + i.c }),
    { kcal: 0, p: 0, f: 0, c: 0 }
  );
  const r = (n: number) => Math.round(n * 10) / 10;

  const inputCls =
    "w-full bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676] focus-visible:ring-1 focus-visible:ring-[#00E676]/50";
  const errCls = "border-rose-500/60 focus:border-rose-500";
  const describedBy = error ? "kbju-error" : undefined;

  return (
    <div className="space-y-4">
      {/* Инфо-сводка помощника */}
      <div className="rounded-2xl border border-[#00E676]/30 bg-[#0E2A1C]/40 p-4 flex gap-3">
        <Sparkles className="w-5 h-5 text-[#00E676] shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-[#E1E3E6]">
          Пока что я умею считать только калории еды, но скоро буду твоим персональным помощником.
        </p>
      </div>

      {/* Переключатель режима */}
      <div className="grid grid-cols-2 gap-1 bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg p-1">
        {(["preset", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`py-2 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors focus-visible:ring-1 focus-visible:ring-[#00E676]/50 ${
              mode === m ? "bg-[#00E676] text-black" : "text-[#989AA0]"
            }`}
          >
            {m === "preset" ? "Из списка" : "Вручную"}
          </button>
        ))}
      </div>

      {/* Форма добавления */}
      <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-3">
        {mode === "preset" ? (
          <>
            <label htmlFor="kbju-preset" className="sr-only">
              Продукт из списка
            </label>
            <select
              id="kbju-preset"
              value={presetIdx}
              onChange={(e) => setPresetIdx(Number(e.target.value))}
              className={inputCls}
            >
              {PRESETS.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name} · {p.kcal} ккал/100г
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="space-y-2">
            <label htmlFor="kbju-name" className="sr-only">
              Название продукта
            </label>
            <input
              id="kbju-name"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="Название продукта"
              aria-invalid={error?.field === "name" || undefined}
              aria-describedby={error?.field === "name" ? describedBy : undefined}
              className={`${inputCls} ${error?.field === "name" ? errCls : ""}`}
            />
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label htmlFor="kbju-kcal" className="sr-only">
                  Калории на 100 г
                </label>
                <input
                  id="kbju-kcal"
                  value={cKcal}
                  onChange={(e) => setCKcal(e.target.value)}
                  inputMode="decimal"
                  placeholder="ккал"
                  aria-invalid={error?.field === "macros" || undefined}
                  aria-describedby={error?.field === "macros" ? describedBy : undefined}
                  className={`${inputCls} ${error?.field === "macros" ? errCls : ""}`}
                />
              </div>
              <div>
                <label htmlFor="kbju-p" className="sr-only">
                  Белки на 100 г
                </label>
                <input
                  id="kbju-p"
                  value={cP}
                  onChange={(e) => setCP(e.target.value)}
                  inputMode="decimal"
                  placeholder="Б"
                  aria-invalid={error?.field === "macros" || undefined}
                  className={`${inputCls} ${error?.field === "macros" ? errCls : ""}`}
                />
              </div>
              <div>
                <label htmlFor="kbju-f" className="sr-only">
                  Жиры на 100 г
                </label>
                <input
                  id="kbju-f"
                  value={cF}
                  onChange={(e) => setCF(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ж"
                  aria-invalid={error?.field === "macros" || undefined}
                  className={`${inputCls} ${error?.field === "macros" ? errCls : ""}`}
                />
              </div>
              <div>
                <label htmlFor="kbju-c" className="sr-only">
                  Углеводы на 100 г
                </label>
                <input
                  id="kbju-c"
                  value={cC}
                  onChange={(e) => setCC(e.target.value)}
                  inputMode="decimal"
                  placeholder="У"
                  aria-invalid={error?.field === "macros" || undefined}
                  className={`${inputCls} ${error?.field === "macros" ? errCls : ""}`}
                />
              </div>
            </div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-wider">Значения на 100 г</p>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="kbju-grams" className="sr-only">
              Вес в граммах
            </label>
            <input
              id="kbju-grams"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              inputMode="numeric"
              placeholder="Граммы"
              aria-invalid={error?.field === "grams" || undefined}
              aria-describedby={error?.field === "grams" ? describedBy : undefined}
              className={`${inputCls} ${error?.field === "grams" ? errCls : ""}`}
            />
          </div>
          <button
            type="button"
            onClick={mode === "preset" ? addPreset : addCustom}
            className="flex items-center gap-1 bg-[#00E676] text-black font-black px-4 rounded-lg text-[10px] uppercase tracking-wider hover:bg-[#00c765] transition-colors focus-visible:ring-1 focus-visible:ring-[#00E676]/50"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        </div>

        {error && (
          <p id="kbju-error" role="alert" className="text-[10px] text-rose-400">
            {error.msg}
          </p>
        )}
      </div>

      {/* Список */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="rounded-xl border border-[#1C1C1E] bg-[#111214] p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {i.name} <span className="text-[#989AA0] font-normal">· {i.grams} г</span>
                </p>
                <p className="text-[9px] text-[#989AA0] mt-0.5">
                  {r(i.kcal)} ккал · Б {r(i.p)} · Ж {r(i.f)} · У {r(i.c)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(i.id)}
                aria-label={`Удалить ${i.name}`}
                className="text-zinc-600 hover:text-rose-500 shrink-0 focus-visible:ring-1 focus-visible:ring-rose-500/50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Итог */}
      <div className="rounded-2xl border border-[#1C1C1E] bg-[#0A0A0A] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Итого</span>
          <span className="text-2xl font-black text-[#00E676]">{Math.round(totals.kcal)} ккал</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: "Белки", v: r(totals.p) },
            { l: "Жиры", v: r(totals.f) },
            { l: "Углеводы", v: r(totals.c) },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border border-[#1C1C1E] bg-[#111214] py-2">
              <div className="text-sm font-black text-white">{x.v}</div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#989AA0]">{x.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
