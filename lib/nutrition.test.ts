import { describe, it, expect } from "vitest";
import { normalizeNumeric, parseGrams, parseNonNegative } from "./nutrition";

describe("normalizeNumeric", () => {
  it("обрезает пробелы и меняет запятую на точку", () => {
    expect(normalizeNumeric(" 1,5 ")).toBe("1.5");
  });
});

describe("parseGrams", () => {
  it("положительное целое", () => expect(parseGrams("100")).toBe(100));
  it("дробное с запятой (RU-ввод)", () => expect(parseGrams("1,5")).toBe(1.5));
  it("ноль → null", () => expect(parseGrams("0")).toBeNull());
  it("отрицательное → null", () => expect(parseGrams("-5")).toBeNull());
  it("пусто → null", () => expect(parseGrams("")).toBeNull());
  it("текст → null", () => expect(parseGrams("abc")).toBeNull());
});

describe("parseNonNegative", () => {
  it("пусто → 0 (значение не указано)", () => expect(parseNonNegative("")).toBe(0));
  it("ноль → 0", () => expect(parseNonNegative("0")).toBe(0));
  it("положительное", () => expect(parseNonNegative("31")).toBe(31));
  it("дробное с запятой", () => expect(parseNonNegative("3,6")).toBe(3.6));
  it("отрицательное → null", () => expect(parseNonNegative("-1")).toBeNull());
  it("мусор → null (а не тихий 0)", () => expect(parseNonNegative("abc")).toBeNull());
});
