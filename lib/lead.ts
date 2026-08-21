// КОНТРАКТ: чистая, серверо-независимая логика заявки («лида»).
// Здесь только валидация входных данных и форматирование текста для Telegram.
// Никаких сетевых вызовов и зависимостей от Next/окружения — чтобы модуль
// легко покрывался юнит-тестами (как lib/nutrition.ts). Инвариант проекта: без `any`.

export interface ValidatedLead {
  name: string;
  email: string;
  role: string; // опционально в UI; пустая строка, если не указано
  subject: string; // опционально
  message: string;
}

export type ValidateResult =
  | { ok: true; lead: ValidatedLead }
  | { ok: false; errors: string[] };

// Прагматичная проверка email: непустой локальный + домен с точкой, без пробелов.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Валидирует произвольное тело запроса и приводит его к ValidatedLead.
 * Обязательные поля: name, email (корректный), message. role/subject опциональны.
 */
export function validateLead(raw: unknown): ValidateResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["Тело запроса должно быть объектом"] };
  }

  const obj = raw as Record<string, unknown>;
  const name = asString(obj.name);
  const email = asString(obj.email);
  const role = asString(obj.role);
  const subject = asString(obj.subject);
  const message = asString(obj.message);

  const errors: string[] = [];
  if (name.length === 0) errors.push("Укажите имя");
  else if (name.length > 100) errors.push("Имя слишком длинное");

  if (email.length === 0) errors.push("Укажите email");
  else if (!isValidEmail(email)) errors.push("Некорректный email");

  if (message.length === 0) errors.push("Напишите сообщение");
  else if (message.length > 4000) errors.push("Сообщение слишком длинное");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, lead: { name, email, role, subject, message } };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Формирует HTML-текст сообщения для Telegram (parse_mode: HTML).
 * Пользовательские значения экранируются, чтобы «<», «>», «&» не ломали разметку.
 */
export function formatLeadMessage(lead: ValidatedLead): string {
  const lines = [
    "🟢 <b>Новая заявка — NAORE</b>",
    `<b>Имя:</b> ${escapeHtml(lead.name)}`,
    `<b>Email:</b> ${escapeHtml(lead.email)}`,
  ];
  if (lead.role) lines.push(`<b>Роль:</b> ${escapeHtml(lead.role)}`);
  if (lead.subject) lines.push(`<b>Тема:</b> ${escapeHtml(lead.subject)}`);
  lines.push("", escapeHtml(lead.message));
  return lines.join("\n");
}
