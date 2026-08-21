import { describe, it, expect } from "vitest";
import { validateLead, formatLeadMessage, isValidEmail } from "./lead";

describe("isValidEmail", () => {
  it("корректный email", () => expect(isValidEmail("a@b.ru")).toBe(true));
  it("обрезает пробелы", () => expect(isValidEmail("  a@b.ru  ")).toBe(true));
  it("без домена → false", () => expect(isValidEmail("a@b")).toBe(false));
  it("без @ → false", () => expect(isValidEmail("ab.ru")).toBe(false));
  it("с пробелом внутри → false", () => expect(isValidEmail("a b@c.ru")).toBe(false));
});

describe("validateLead", () => {
  it("валидная заявка", () => {
    const r = validateLead({ name: "Иван", email: "a@b.ru", message: "Привет" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lead.name).toBe("Иван");
      expect(r.lead.role).toBe("");
      expect(r.lead.subject).toBe("");
    }
  });

  it("тримит поля и сохраняет role/subject", () => {
    const r = validateLead({ name: "  Иван ", email: " a@b.ru ", role: " Тренер ", subject: " Вопрос ", message: " Текст " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lead.name).toBe("Иван");
      expect(r.lead.email).toBe("a@b.ru");
      expect(r.lead.role).toBe("Тренер");
      expect(r.lead.subject).toBe("Вопрос");
      expect(r.lead.message).toBe("Текст");
    }
  });

  it("не объект → ошибка", () => {
    const r = validateLead("строка");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it("пустое имя → ошибка", () => {
    const r = validateLead({ name: "  ", email: "a@b.ru", message: "Привет" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Укажите имя");
  });

  it("некорректный email → ошибка", () => {
    const r = validateLead({ name: "Иван", email: "плохой", message: "Привет" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Некорректный email");
  });

  it("пустое сообщение → ошибка", () => {
    const r = validateLead({ name: "Иван", email: "a@b.ru", message: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Напишите сообщение");
  });

  it("слишком длинное сообщение → ошибка", () => {
    const r = validateLead({ name: "Иван", email: "a@b.ru", message: "x".repeat(4001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Сообщение слишком длинное");
  });

  it("несколько ошибок сразу", () => {
    const r = validateLead({ name: "", email: "bad", message: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(3);
  });
});

describe("formatLeadMessage", () => {
  it("содержит обязательные поля", () => {
    const msg = formatLeadMessage({ name: "Иван", email: "a@b.ru", role: "", subject: "", message: "Привет" });
    expect(msg).toContain("Иван");
    expect(msg).toContain("a@b.ru");
    expect(msg).toContain("Привет");
  });

  it("опускает пустые role/subject", () => {
    const msg = formatLeadMessage({ name: "Иван", email: "a@b.ru", role: "", subject: "", message: "Привет" });
    expect(msg).not.toContain("Роль:");
    expect(msg).not.toContain("Тема:");
  });

  it("включает заполненные role/subject", () => {
    const msg = formatLeadMessage({ name: "Иван", email: "a@b.ru", role: "Тренер", subject: "Вопрос", message: "Привет" });
    expect(msg).toContain("Роль:");
    expect(msg).toContain("Тренер");
    expect(msg).toContain("Тема:");
  });

  it("экранирует HTML в пользовательском вводе", () => {
    const msg = formatLeadMessage({ name: "<b>x</b>", email: "a@b.ru", role: "", subject: "", message: "1 < 2 & 3" });
    expect(msg).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(msg).toContain("1 &lt; 2 &amp; 3");
  });
});
