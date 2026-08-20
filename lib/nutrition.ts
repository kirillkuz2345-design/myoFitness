// lib/nutrition.ts
// Чистые функции парсинга/валидации числового ввода для калькулятора КБЖУ.
// Вынесены отдельно, чтобы покрыть unit-тестами без рендера компонента.

// Нормализует ввод: обрезает пробелы и заменяет запятую на точку (RU-локаль).
export function normalizeNumeric(str: string): string {
  return str.trim().replace(",", ".");
}

// Вес в граммах: строго положительное конечное число, иначе null.
export function parseGrams(str: string): number | null {
  const n = Number(normalizeNumeric(str));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Значение КБЖУ: пусто → 0 (не указано); иначе неотрицательное конечное число, иначе null.
export function parseNonNegative(str: string): number | null {
  const t = normalizeNumeric(str);
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
