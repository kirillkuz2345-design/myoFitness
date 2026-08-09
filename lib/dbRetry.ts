// lib/dbRetry.ts
// Повтор Supabase-операции при ТРАНЗИЕНТНОЙ (сетевой) ошибке.
// Постоянные ошибки БД (RLS 42501, unique 23505, PGRST...) имеют code — их не ретраим.
import type { PostgrestError } from "@supabase/supabase-js";

const NET_HINTS = ["fetch", "network", "timeout", "connection", "failed to fetch"];

function isTransient(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code) return false; // есть код БД → постоянная ошибка, не ретраим
  const msg = (error.message ?? "").toLowerCase();
  return msg === "" || NET_HINTS.some((h) => msg.includes(h));
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
 * Выполняет операцию и повторяет её при сетевом сбое.
 * Тип результата сохраняется как есть — вызывающий код видит тот же тип,
 * что и при прямом вызове Supabase (data/error типизируются корректно).
 * tries = общее число попыток (2 = один повтор). delayMs растёт линейно.
 */
export async function withRetry<T>(
  op: () => T,
  tries = 2,
  delayMs = 800,
): Promise<Awaited<T>> {
  let res = await op();
  let attempt = 1;
  while (attempt < tries && isTransient(resultError(res))) {
    await new Promise((r) => setTimeout(r, delayMs * attempt));
    res = await op();
    attempt += 1;
  }
  return res;
}
