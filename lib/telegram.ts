// КОНТРАКТ: тонкий серверный клиент Telegram Bot API для приёма заявок.
// Заявки НЕ хранятся в БД — единственный «сток» это чат бота (решение проекта).
// fetch инъектируется параметром, чтобы модуль тестировался без реальной сети.
// Инвариант проекта: без `any`.

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Читает конфигурацию бота из окружения. Возвращает null, если не задано —
 * чтобы вызывающий код мог корректно ответить «приём недоступен», а не упасть.
 * Переменные СЕРВЕРНЫЕ (без NEXT_PUBLIC_) — токен не должен попадать в клиент.
 */
export function getTelegramConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): TelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/**
 * Отправляет сообщение в чат бота. Никогда не бросает: сетевые/HTTP-ошибки
 * возвращаются как { ok: false, ... }, чтобы роут мог выбрать корректный статус.
 */
export async function sendTelegramMessage(
  text: string,
  cfg: TelegramConfig,
  fetchImpl: FetchLike = fetch,
): Promise<SendResult> {
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Telegram API ответил ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка сети";
    return { ok: false, status: 0, error: message };
  }
}
