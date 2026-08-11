// lib/uuid.ts
// Генерация UUID с fallback: crypto.randomUUID доступен не везде
// (старые браузеры, не-secure контексты — не HTTPS/не localhost).

export function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (RFC 4122 v4) для окружений без crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
