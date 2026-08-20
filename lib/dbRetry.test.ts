import { describe, it, expect, vi } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { isTransient, withRetry } from "./dbRetry";

// Фабрика ошибки Postgrest без использования any (проходит инвариант "нет any").
const pgError = (over: Partial<PostgrestError>): PostgrestError =>
  ({ name: "PostgrestError", message: "", details: "", hint: "", code: "", ...over }) as PostgrestError;

describe("isTransient", () => {
  it("null → false", () => expect(isTransient(null)).toBe(false));

  it("ошибка с кодом БД → false (постоянная, не ретраим)", () =>
    expect(isTransient(pgError({ code: "23505", message: "duplicate key" }))).toBe(false));

  it("сетевая ошибка (Failed to fetch) → true", () =>
    expect(isTransient(pgError({ code: "", message: "TypeError: Failed to fetch" }))).toBe(true));

  it("timeout соединения → true", () =>
    expect(isTransient(pgError({ code: "", message: "connection timeout" }))).toBe(true));

  it("пустое сообщение без кода → false (больше НЕ транзиент)", () =>
    expect(isTransient(pgError({ code: "", message: "" }))).toBe(false));
});

describe("withRetry", () => {
  it("успех с первого раза — один вызов", async () => {
    const op = vi.fn(() => Promise.resolve({ data: 1, error: null }));
    const res = await withRetry(op);
    expect(res).toEqual({ data: 1, error: null });
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("постоянная ошибка (код) — без повторов", async () => {
    const op = vi.fn(() => Promise.resolve({ data: null, error: pgError({ code: "42501" }) }));
    await withRetry(op, 3, 0);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("транзиентная ошибка — повторяет до tries", async () => {
    const op = vi.fn(() => Promise.resolve({ data: null, error: pgError({ message: "network error" }) }));
    await withRetry(op, 3, 0); // baseDelayMs=0 → без реальных задержек
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("успех после одного транзиентного сбоя — два вызова", async () => {
    let n = 0;
    const op = vi.fn(() => {
      n += 1;
      return Promise.resolve(
        n === 1
          ? { data: null, error: pgError({ message: "fetch failed" }) }
          : { data: "ok", error: null },
      );
    });
    const res = await withRetry(op, 3, 0);
    expect(res).toEqual({ data: "ok", error: null });
    expect(op).toHaveBeenCalledTimes(2);
  });
});
