import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "123";
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

function req(body: unknown): Request {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/lead", () => {
  it("валидная заявка → 200 и отправка в Telegram", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ name: "Иван", email: "a@b.ru", message: "Привет" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/bottest-token/sendMessage");
    const payload = JSON.parse(String(init?.body));
    expect(payload.chat_id).toBe("123");
    expect(payload.text).toContain("Иван");
  });

  it("невалидный email → 400, Telegram не вызывается", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ name: "Иван", email: "bad", message: "Привет" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(Array.isArray(json.errors)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("битый JSON → 400", async () => {
    const res = await POST(req("{ не json"));
    expect(res.status).toBe(400);
  });

  it("нет конфигурации Telegram → 503", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const res = await POST(req({ name: "Иван", email: "a@b.ru", message: "Привет" }));
    expect(res.status).toBe(503);
  });

  it("Telegram вернул ошибку → 502", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))));
    const res = await POST(req({ name: "Иван", email: "a@b.ru", message: "Привет" }));
    expect(res.status).toBe(502);
  });
});
