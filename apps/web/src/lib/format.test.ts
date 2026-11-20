import { describe, expect, it } from "vitest";
import {
  abreviarUnidade,
  centavosParaCampo,
  dataLocalISO,
  formatBRL,
  formatBRLInteiro,
  formatData,
  formatDataCurta,
  formatDiaMes,
  formatPercentual,
  formatQuantidade,
  formatQuantidadeMov,
  mesPorExtenso,
  parseReais,
  primeiroDiaDoMes,
  variacaoPercentual,
} from "./format";

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

describe("formatadores do design", () => {
  it("mostra valores de resumo em reais inteiros", () => {
    expect(formatBRLInteiro(12845099).replace(/\s/g, " ")).toBe("R$ 128.451");
    expect(formatBRLInteiro(0).replace(/\s/g, " ")).toBe("R$ 0");
  });

  it("formata quantidades de movimentação com sinal tipográfico e unidade abreviada", () => {
    expect(formatQuantidadeMov(30, "un")).toBe("+ 30 un.");
    expect(formatQuantidadeMov(-8, "un")).toBe("− 8 un.");
    expect(formatQuantidadeMov(-1500, "kg")).toBe("− 1.500 kg");
    expect(formatQuantidadeMov(5)).toBe("+ 5");
    expect(abreviarUnidade("un")).toBe("un.");
    expect(abreviarUnidade("cx")).toBe("cx");
  });

  it("calcula a variação percentual entre meses", () => {
    expect(variacaoPercentual(12, 10)).toBeCloseTo(20);
    expect(variacaoPercentual(5, 10)).toBeCloseTo(-50);
    expect(variacaoPercentual(5, 0)).toBeNull();
    expect(formatPercentual(12.84)).toBe("12,8%");
    expect(formatPercentual(-5)).toBe("5,0%");
  });

  it("formata datas curtas a partir do timestamp UTC do banco", () => {
    expect(formatDataCurta("2026-11-20 12:00:00")).toMatch(/^20 nov, \d{2}:\d{2}$/);
    expect(formatDiaMes("2026-03-05 12:00:00")).toBe("5 mar");
  });

  it("monta as datas dos filtros no fuso local", () => {
    const d = new Date(2026, 10, 20, 23, 30);
    expect(dataLocalISO(d)).toBe("2026-11-20");
    expect(primeiroDiaDoMes(d)).toBe("2026-11-01");
    expect(mesPorExtenso(d)).toBe("Novembro de 2026");
  });
});
