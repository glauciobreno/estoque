import { describe, expect, it } from "vitest";
import { variacaoDoSaldo } from "../src/estoque.js";

describe("variacaoDoSaldo", () => {
  it("entrada soma e saída subtrai", () => {
    expect(variacaoDoSaldo({ tipo: "entrada", produtoId: 1, quantidade: 5 }, 10)).toBe(5);
    expect(variacaoDoSaldo({ tipo: "saida", produtoId: 1, quantidade: 4 }, 10)).toBe(-4);
  });

  it("permite zerar o saldo, mas não deixá-lo negativo", () => {
    expect(variacaoDoSaldo({ tipo: "saida", produtoId: 1, quantidade: 10 }, 10)).toBe(-10);
    expect(() => variacaoDoSaldo({ tipo: "saida", produtoId: 1, quantidade: 11 }, 10)).toThrow(
      /Saldo insuficiente/,
    );
  });

  it("ajuste calcula a diferença até o saldo contado", () => {
    expect(
      variacaoDoSaldo({ tipo: "ajuste", produtoId: 1, novoSaldo: 3, motivo: "contagem" }, 10),
    ).toBe(-7);
    expect(
      variacaoDoSaldo({ tipo: "ajuste", produtoId: 1, novoSaldo: 15, motivo: "contagem" }, 10),
    ).toBe(5);
  });

  it("ajuste sem diferença é recusado", () => {
    expect(() =>
      variacaoDoSaldo({ tipo: "ajuste", produtoId: 1, novoSaldo: 10, motivo: "contagem" }, 10),
    ).toThrow(/não altera/);
  });
});
