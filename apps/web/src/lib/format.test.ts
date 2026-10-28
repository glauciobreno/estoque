import { describe, expect, it } from "vitest";
import { centavosParaCampo, formatBRL, formatData, formatQuantidade, parseReais } from "./format";

describe("parseReais", () => {
  it.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["1.234,56", 123456],
    ["R$ 7", 700],
    ["0,05", 5],
    ["", 0],
    ["  ", 0],
  ])("converte %j em %i centavos", (texto, esperado) => {
    expect(parseReais(texto)).toBe(esperado);
  });

  it.each(["abc", "12,345", "-3", "1,2,3", "12,5x"])("recusa %j", (texto) => {
    expect(parseReais(texto)).toBeNull();
  });
});

describe("formatação", () => {
  it("formata centavos como moeda", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });

  it("devolve centavos no formato do campo", () => {
    expect(centavosParaCampo(1250)).toBe("12,50");
    expect(parseReais(centavosParaCampo(99))).toBe(99);
  });

  it("mostra sinal na variação de quantidade", () => {
    expect(formatQuantidade(5)).toBe("+5");
    expect(formatQuantidade(-3)).toBe("-3");
  });

  it("interpreta o timestamp do banco como UTC", () => {
    const texto = formatData("2026-01-15 12:00:00");
    expect(texto).toContain("15/01/2026");
  });
});
