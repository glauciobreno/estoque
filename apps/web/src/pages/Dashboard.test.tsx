import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, mocksDoDashboard, renderizarApp, resumo, simularApi } from "../test/helpers";

afterEach(() => vi.unstubAllGlobals());

const produto = (id: number, nome: string, saldoAtual: number, estoqueMinimo: number) => ({
  id,
  sku: `S-${id}`,
  nome,
  categoriaId: null,
  unidade: "un",
  precoCusto: 0,
  precoVenda: 0,
  estoqueMinimo,
  saldoAtual,
  ativo: true,
  criadoEm: "2026-01-01 00:00:00",
});

const movimentacao = (id: number, tipo: string, quantidade: number, nome: string) => ({
  id,
  produtoId: id,
  produtoSku: `S-${id}`,
  produtoNome: nome,
  produtoUnidade: "un",
  tipo,
  quantidade,
  motivo: null,
  fornecedorId: null,
  usuarioId: 1,
  usuarioNome: "Mariana Costa",
  criadoEm: "2026-11-20 12:32:00",
});

const dias = Array.from({ length: 7 }, (_, i) => ({
  data: `2026-11-${14 + i}`,
  entradas: 10 * (i + 1),
  saidas: 5 * (i + 1),
}));

const comDados = () =>
  simularApi({
    "GET /auth/me": { corpo: admin },
    ...mocksDoDashboard({
      valorEmEstoque: 12845000,
      produtosAtivos: 248,
      produtosNovosNoMes: 12,
      abaixoDoMinimo: 12,
      produtosInativos: 8,
      movimentacoesNoMes: 1284,
      movimentacoesMesAnterior: 1138,
    }),
    "GET /estoque/alertas": {
      corpo: {
        items: [
          produto(1, "Mouse sem fio Logitech", 4, 15),
          produto(2, "Hub USB-C 7 em 1", 3, 10),
          produto(3, "Caderno A5", 0, 20),
        ],
        total: 12,
        page: 1,
        pageSize: 3,
      },
    },
    "GET /movimentacoes": {
      corpo: {
        items: [
          movimentacao(1, "entrada", 30, "Teclado mecânico K380"),
          movimentacao(2, "saida", -8, "Mouse sem fio Logitech"),
        ],
        total: 2,
        page: 1,
        pageSize: 4,
      },
    },
    "GET /estoque/fluxo": { corpo: { dias } },
  });

describe("dashboard", () => {
  it("mostra os quatro indicadores do design", async () => {
    comDados();
    renderizarApp("/");
    expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
    expect(await screen.findByText(/R\$\s*128\.450/)).toBeInTheDocument();
    expect(screen.getByText("248")).toBeInTheDocument();
    expect(screen.getByText("+ 12")).toBeInTheDocument();
    expect(screen.getByText(/novos produtos neste mês/)).toBeInTheDocument();
    expect(screen.getByText("12 produtos")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByText("1.284")).toBeInTheDocument();
    expect(screen.getByText("↗ 12,8%")).toBeInTheDocument();
    expect(screen.getByText(/em relação ao mês anterior/)).toBeInTheDocument();
  });

  it("mostra queda de movimentações com seta para baixo", async () => {
    simularApi({
      "GET /auth/me": { corpo: admin },
      ...mocksDoDashboard({ movimentacoesNoMes: 50, movimentacoesMesAnterior: 100 }),
    });
    renderizarApp("/");
    expect(await screen.findByText("↘ 50,0%")).toBeInTheDocument();
  });

  it("sem base de comparação, mostra um texto neutro no lugar da variação", async () => {
    simularApi({
      "GET /auth/me": { corpo: admin },
      ...mocksDoDashboard({ movimentacoesNoMes: 7, movimentacoesMesAnterior: 0 }),
    });
    renderizarApp("/");
    expect(await screen.findByText("entradas, saídas e ajustes")).toBeInTheDocument();
    expect(screen.queryByText(/↗|↘/)).not.toBeInTheDocument();
  });

  it("lista os produtos em alerta com o nível atual e o link para ver todos", async () => {
    comDados();
    renderizarApp("/");
    expect(await screen.findByText("4 de 15 un. mínimas")).toBeInTheDocument();
    expect(screen.getByText("12 itens")).toBeInTheDocument();
    expect(screen.getByText("0 de 20 un. mínimas")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Nível atual: 27% do mínimo" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Nível atual: 0% do mínimo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos os produtos em alerta →" })).toHaveAttribute(
      "href",
      "/produtos?aba=baixo",
    );
    expect(screen.getByRole("link", { name: "Mouse sem fio Logitech" })).toHaveAttribute(
      "href",
      "/produtos/1",
    );
  });

  it("sem alertas, diz que o estoque está em equilíbrio", async () => {
    simularApi({ "GET /auth/me": { corpo: admin }, ...mocksDoDashboard() });
    renderizarApp("/");
    expect(await screen.findByText(/Estoque em equilíbrio/)).toBeInTheDocument();
    expect(screen.getByText("todos acima do mínimo")).toBeInTheDocument();
  });

  it("mostra as movimentações recentes com quantidade, unidade e responsável", async () => {
    comDados();
    renderizarApp("/");
    const entrada = await screen.findByRole("row", { name: /Teclado mecânico K380/ });
    expect(within(entrada).getByText("Entrada")).toBeInTheDocument();
    expect(within(entrada).getByText("+ 30 un.")).toHaveClass("text-sucesso");
    expect(within(entrada).getByText("Mariana Costa")).toBeInTheDocument();
    expect(within(entrada).getByText("● Concluído")).toBeInTheDocument();
    const saida = screen.getByRole("row", { name: /Mouse sem fio Logitech/ });
    expect(within(saida).getByText("− 8 un.")).toHaveClass("text-marca-700");
    expect(screen.getByRole("link", { name: "Ver todas →" })).toHaveAttribute(
      "href",
      "/movimentacoes",
    );
  });

  it("o gráfico acompanha o período escolhido e envia o fuso do navegador", async () => {
    const chamadas = comDados();
    renderizarApp("/");
    expect(await screen.findByText("Entradas e saídas nos últimos 7 dias")).toBeInTheDocument();
    await waitFor(() => expect(chamadas.some((c) => c.rota === "GET /estoque/fluxo")).toBe(true));
    const primeira = chamadas.find((c) => c.rota === "GET /estoque/fluxo")!;
    expect(primeira.consulta.get("dias")).toBe("7");
    expect(primeira.consulta.get("fuso")).toBe(String(-new Date().getTimezoneOffset()));

    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "Período do gráfico" }), "30");
    expect(await screen.findByText("Entradas e saídas nos últimos 30 dias")).toBeInTheDocument();
    await waitFor(() => expect(chamadas.some((c) => c.consulta.get("dias") === "30")).toBe(true));
  });

  it("o botão de nova movimentação abre o formulário", async () => {
    comDados();
    renderizarApp("/");
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "+ Nova movimentação" }));
    expect(screen.getByRole("dialog", { name: "Nova movimentação" })).toBeInTheDocument();
  });

  it("não usa mais de um pedido de resumo (menu e dashboard compartilham a consulta)", async () => {
    const chamadas = comDados();
    renderizarApp("/");
    await screen.findByText(/R\$\s*128\.450/);
    expect(chamadas.filter((c) => c.rota === "GET /estoque/resumo")).toHaveLength(1);
  });

  it("indicadores de um resumo vazio aparecem zerados, sem quebrar", async () => {
    simularApi({ "GET /auth/me": { corpo: admin }, ...mocksDoDashboard(resumo()) });
    renderizarApp("/");
    expect(await screen.findByText("0 produtos")).toBeInTheDocument();
    expect(screen.getByText("produtos ativos no catálogo")).toBeInTheDocument();
  });
});
