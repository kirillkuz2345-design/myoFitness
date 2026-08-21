// Route Handler: POST /api/lead — приём заявок с лендинга.
// Поток: JSON → валидация (lib/lead) → отправка в Telegram (lib/telegram) → JSON-ответ.
// Заявки не сохраняются в БД: единственный приёмник — чат Telegram-бота.
import { validateLead, formatLeadMessage } from "@/lib/lead";
import { getTelegramConfigFromEnv, sendTelegramMessage } from "@/lib/telegram";

// POST не кэшируется по умолчанию; фиксируем динамику явно ради читаемости.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, errors: ["Некорректный JSON"] }, { status: 400 });
  }

  const result = validateLead(body);
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors }, { status: 400 });
  }

  const cfg = getTelegramConfigFromEnv();
  if (!cfg) {
    // Токен/чат не сконфигурированы на сервере — не 500, а «временно недоступно».
    return Response.json(
      { ok: false, errors: ["Приём заявок временно недоступен"] },
      { status: 503 },
    );
  }

  const sent = await sendTelegramMessage(formatLeadMessage(result.lead), cfg);
  if (!sent.ok) {
    return Response.json(
      { ok: false, errors: ["Не удалось отправить заявку, попробуйте позже"] },
      { status: 502 },
    );
  }

  return Response.json({ ok: true }, { status: 200 });
}
