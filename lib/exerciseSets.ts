// lib/exerciseSets.ts
// Подходы упражнения: каждый подход имеет свои повторы и вес.
// Источник правды — колонка exercises.sets_data (jsonb-массив). Старые записи без
// sets_data разворачиваются из скалярных sets/reps/weight для совместимости.

export interface SetEntry {
  reps: string;
  weight: number | null;
}

// Безопасный UUID: crypto.randomUUID отсутствует на старом iOS Safari (< 15.4).
export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Ввод в конструкторе (строки, т.к. это значения инпутов).
export interface DraftSetInput {
  reps: string;
  weight: string;
}

interface ExerciseLike {
  sets_data?: unknown;
  sets?: number | null;
  reps?: string | null;
  weight?: number | null;
}

// Нормализуем упражнение к массиву подходов (учитывая старый формат).
export function toSetEntries(ex: ExerciseLike): SetEntry[] {
  const raw = ex.sets_data;
  if (Array.isArray(raw)) {
    return raw.map((s) => {
      const o = (s ?? {}) as { reps?: unknown; weight?: unknown };
      const w = o.weight;
      return {
        reps: o.reps != null ? String(o.reps) : "",
        weight: w != null && w !== "" ? Number(w) : null,
      };
    });
  }
  const n = ex.sets ?? 0;
  return Array.from({ length: n }, () => ({ reps: ex.reps ?? "", weight: ex.weight ?? null }));
}

// Ввод конструктора → массив подходов (строки).
export function toDraftSets(ex: ExerciseLike): DraftSetInput[] {
  return toSetEntries(ex).map((s) => ({
    reps: s.reps,
    weight: s.weight != null ? String(s.weight) : "",
  }));
}

// Пустой подход для конструктора.
export function emptyDraftSet(): DraftSetInput {
  return { reps: "", weight: "" };
}

// Собираем payload упражнения из подходов: sets_data + совместимые скалярные поля.
export function buildSetsPayload(draftSets: DraftSetInput[]): {
  sets_data: SetEntry[];
  sets: number;
  reps: string;
  weight: number | null;
} {
  const entries: SetEntry[] = draftSets.map((s) => ({
    reps: s.reps.trim(),
    weight: s.weight.trim() === "" ? null : Number(s.weight),
  }));
  const first = entries[0];
  return {
    sets_data: entries,
    sets: entries.length,
    reps: first ? first.reps : "",
    weight: first ? first.weight : null,
  };
}

// Краткая сводка подходов для бейджа: "3 подх · 60–70 кг".
export function summarizeSets(entries: SetEntry[]): string {
  if (entries.length === 0) return "нет подходов";
  const weights = entries.map((e) => e.weight).filter((w): w is number => w != null);
  if (weights.length === 0) return `${entries.length} подх`;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const w = min === max ? `${min}` : `${min}–${max}`;
  return `${entries.length} подх · ${w} кг`;
}
