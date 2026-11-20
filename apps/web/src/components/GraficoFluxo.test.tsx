import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DiaDeFluxo } from "../lib/types";
import { escalaDoEixo, GraficoFluxo } from "./GraficoFluxo";

const semana = (valores: [number, number][]): DiaDeFluxo[] =>
  valores.map(([entradas, saidas], i) => ({
    data: `2026-11-${String(14 + i).padStart(2, "0")}`,
    entradas,
    saidas,
  }));

describe("escalaDoEixo", () => {
  it.each([
    [0, 1, 3],
    [2, 1, 3],
    [9, 5, 15],
    [150, 50, 150],
    [153, 100, 300],
    [412, 200, 600],
    [3400, 2000, 6000],
  ])("máximo %i → passo %i e topo %i", (maximo, passo, topo) => {
    expect(escalaDoEixo(maximo)).toEqual({ passo, topo });
  });

  it("o topo sempre comporta o maior valor", () => {
    for (const max of [1, 7, 33, 99, 101, 777, 1234, 25000]) {
      expect(escalaDoEixo(max).topo).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("GraficoFluxo", () => {
  it("desenha uma barra de entrada e uma de saída por dia, com os dias da semana", () => {
    const dias = semana([
      [10, 4],
      [0, 0],
      [30, 12],
      [5, 5],
      [8, 1],
      [2, 2],
      [20, 9],
    ]);
    const { container } = render(<GraficoFluxo dias={dias} />);
    expect(container.querySelectorAll(".bg-marca-600")).toHaveLength(7);
    expect(container.querySelectorAll(".bg-\\[\\#d4cec1\\]")).toHaveLength(7);
    // 14/11/2026 é sábado
    for (const dia of ["Sáb", "Dom", "Seg", "Ter", "Qua", "Qui", "Sex"]) {
      expect(screen.getAllByText(dia).length).toBeGreaterThan(0);
    }
  });

  it("escala as barras pelo maior valor", () => {
    const { container } = render(<GraficoFluxo dias={semana([[150, 75]])} />);
    const [entrada, saida] = [...container.querySelectorAll<HTMLElement>(".rounded-\\[3px\\]")];
    expect(entrada?.style.height).toBe("176px"); // 150 = passo 50 × 3 = topo
    expect(saida?.style.height).toBe("88px");
  });

  it("explica quando não houve movimento", () => {
    render(
      <GraficoFluxo
        dias={semana([
          [0, 0],
          [0, 0],
        ])}
      />,
    );
    expect(screen.getByText("Nenhuma entrada ou saída neste período.")).toBeInTheDocument();
  });

  it("oferece os mesmos números em uma tabela para leitores de tela", () => {
    render(
      <GraficoFluxo
        dias={semana([
          [10, 4],
          [7, 3],
        ])}
      />,
    );
    const tabela = screen.getByRole("table", { name: "Entradas e saídas por dia" });
    const linhas = within(tabela).getAllByRole("row");
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toHaveTextContent("2026-11-1410");
    expect(
      screen.getByRole("img", { name: "Entradas e saídas por dia nos últimos 2 dias" }),
    ).toBeInTheDocument();
  });

  it("em períodos longos mostra datas em vez de dias da semana, sem repetir todos os rótulos", () => {
    const dias = Array.from({ length: 30 }, (_, i) => ({
      data: `2026-11-${String(i + 1).padStart(2, "0")}`,
      entradas: i,
      saidas: 1,
    }));
    const { container } = render(<GraficoFluxo dias={dias} />);
    const rotulos = [...container.querySelectorAll("span.mt-3")]
      .map((e) => e.textContent)
      .filter(Boolean);
    expect(rotulos[0]).toBe("01/11");
    expect(rotulos.at(-1)).toBe("30/11");
    expect(rotulos.length).toBeLessThan(30);
  });
});
