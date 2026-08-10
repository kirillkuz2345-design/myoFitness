// lib/dbRetry.ts
// Повтор Supabase-операции при ТРАНЗИЕНТНОЙ (сетевой) ошибке.
// Постоянные ошибки БД (RLS 42501, unique 23505, PGRST...) имеют code — их не ретраим.
import type { PostgrestError } from "@supabase/supabase-js";

const NET_HINTS = ["fetch", "network", "timeout", "connection", "failed to fetch"];

// Общий бюджет времени на все повторы (мс) — чтобы не задерживать UI надолго.
const MAX_TOTAL_MS = 8000;

function isTransient(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code) return false; // есть код БД → постоянная ошибка, не ретраим
  const msg = (error.message ?? "").toLowerCase();
  // Ретраим ТОЛЬКО по явным признакам сетевого сбоя.
  // Пустое сообщение больше НЕ считаем транзиентным: это могла быть непонятная
  // постоянная ошибка, повтор которой бесполезен и лишь тормозит UI.
  return NET_HINTS.some((h) => msg.includes(h));
}

// Безопасно достаём error из результата Supabase-операции любой формы,
// не завязываясь на конкретный тип ответа (withRetry остаётся прозрачным для типов).
function resultError(res: unknown): PostgrestError | null {
  if (res && typeof res === "object" && "error" in res) {
    return (res as { error: PostgrestError | null }).error;
  }
  return null;
}

/**
 * Выполняет операцию и повторяет её при ТРАНЗИЕНТНОМ (сетевом) сбое.
 * Тип результата сохраняется как есть — вызывающий код видит тот же тип,
 * что и при прямом вызове Supabase (data/error типизируются корректно).
 *
 * Задержка растёт экспоненциально с «equal jitter» и ограничена общим бюджетом
 * времени (MAX_TOTAL_MS), чтобы не подвешивать интерфейс.
 *
 * @param op          операция, обычно () => supabase.from(...)...
 * @param tries       максимум попыток (по умолчанию 3 = до 2 повторов)
 * @param baseDelayMs базовая задержка перед первым повтором (по умолчанию 400мс)
 */
export async function withRetry<T>(
  op: () => T,
  tries = 3,
  baseDelayMs = 400,
): Promise<Awaited<T>> {
  const startedAt = Date.now();
  let res = await op();
  let attempt = 1;

  while (attempt < tries && isTransient(resultError(res))) {
    // Экспоненциальный backoff с equal jitter: delay ∈ [ceiling/2, ceiling].
    const ceiling = baseDelayMs * 2 ** (attempt - 1);
    const delay = Math.floor(ceiling / 2 + Math.random() * (ceiling / 2));

    // Не выходим за общий бюджет времени.
    if (Date.now() - startedAt + delay > MAX_TOTAL_MS) break;

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[withRetry] транзиентная ошибка, повтор ${attempt}/${tries - 1} через ${delay}мс`,
      );
    }

    await new Promise((r) => setTimeout(r, delay));
    res = await op();
    attempt += 1;
  }

  return res;
}
