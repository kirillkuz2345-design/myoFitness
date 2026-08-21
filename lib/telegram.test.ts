import { describe, it, expect, vi } from "vitest";
import { getTelegramConfigFromEnv, sendTelegramMessage, type FetchLike } from "./telegram";

describe("getTelegramConfigFromEnv", () => {
  it("возвращает конфиг при заданных переменных", () => {
    const cfg = getTelegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" });
    expect(cfg).toEqual({ botToken: "t", chatId: "1" });
  });
  it("тримит значения", () => {
    const cfg = getTelegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: " t ", TELEGRAM_CHAT_ID: " 1 " });
    expect(cfg).toEqual({ botToken: "t", chatId: "1" });
  });
  it("нет токена → null", () => {
    expect(getTelegramConfigFromEnv({ TELEGRAM_CHAT_ID: "1" })).toBeNull();
  });
  it("нет chatId → null", () => {
    expect(getTelegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: "t" })).toBeNull();
  });
  it("пустые строки → null", () => {
    expect(getTelegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: "  ", TELEGRAM_CHAT_ID: "  " })).toBeNull();
  });
});

const cfg = { botToken: "tok", chatId: "42" };

describe("sendTelegramMessage", () => {
  it("успешная отправка → ok, верный URL и payload", async () => {
    const fetchMock = vi.fn<FetchLike>(() => Promise.resolve(new Response(null, { status: 200 })));
    const res = await sendTelegramMessage("привет", cfg, fetchMock);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottok/sendMessage");
    const payload = JSON.parse(String(init?.body));
    expect(payload.chat_id).toBe("42");
    expect(payload.text).toBe("привет");
    expect(payload.parse_mode).toBe("HTML");
  });

  it("HTTP-ошибка (500) → ok:false со статусом", async () => {
    const fetchMock = vi.fn<FetchLike>(() => Promise.resolve(new Response(null, { status: 500 })));
    const res = await sendTelegramMessage("привет", cfg, fetchMock);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(res.error).toBeTruthy();
  });

  it("сетевой сбой (throw) → ok:false, не бросает", async () => {
    const fetchMock = vi.fn<FetchLike>(() => Promise.reject(new Error("network down")));
    const res = await sendTelegramMessage("привет", cfg, fetchMock);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error).toBe("network down");
  });
});
