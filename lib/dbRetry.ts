// lib/dbRetry.ts
// Повтор Supabase-операции при ТРАНЗИЕНТНОЙ (сетевой) ошибке.
// Постоянные ошибки БД (RLS 42501, unique 23505, PGRST...) имеют code — их не ретраим.
import type { PostgrestError } from "@supabase/supabase-js";

interface HasError {
  error: PostgrestError | null;
}

const NET_HINTS = ["fetch", "network", "timeout", "connection", "failed to fetch"];

function isTransient(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code) return false; // есть код БД → постоянная ошибка, не ретраим
  const msg = (error.message ?? "").toLowerCase();
  return msg === "" || NET_HINTS.some((h) => msg.includes(h));
}

/**
 * Выполняет операцию и повторяет её при сетевом сбое.
 * tries = общее число попыток (2 = один повтор). delayMs растёт линейно.
 */
export async function withRetry<R extends HasError>(
  op: () => PromiseLike<R>,
  tries = 2,
  delayMs = 800
): Promise<R> {
  let res = await op();
  let attempt = 1;
  while (res.error && isTransient(res.error) && attempt < tries) {
    await new Promise((r) => setTimeout(r, delayMs * attempt));
    res = await op();
    attempt += 1;
  }
  return res;
}
