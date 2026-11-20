import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, operador, pagina, renderizarApp, resumo, simularApi } from "../test/helpers";

afterEach(() => vi.unstubAllGlobals());

const produto = {
  id: 1,
  sku: "ARZ-1",
  nome: "Arroz 5kg",
  categoriaId: null,
  unidade: "un",
  precoCusto: 1000,
  precoVenda: 1500,
  estoqueMinimo: 10,
  saldoAtual: 4,
  ativo: true,
  criadoEm: "2026-01-01 00:00:00",
};

const rotas = (usuario: typeof admin) => ({
  "GET /auth/me": { corpo: usuario },
  "GET /categorias": { corpo: pagina([]) },
  "GET /produtos": { corpo: pagina([produto]) },
  "GET /estoque/resumo": { corpo: resumo({ produtosAtivos: 1, abaixoDoMinimo: 1 }) },
});

async function abrirMenuDoProduto() {
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: "Ações de Arroz 5kg" }));
  return within(screen.getByRole("menu"));
}

describe("permissões na interface", () => {
  it("admin vê as ações de cadastro", async () => {
    simularApi(rotas(admin));
    renderizarApp("/produtos");
    expect(await screen.findByText("Arroz 5kg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Novo produto" })).toBeInTheDocument();

    const menu = await abrirMenuDoProduto();
    expect(menu.getByRole("menuitem", { name: "Movimentar" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Excluir" })).toBeInTheDocument();
  });

  it("operador só consegue movimentar", async () => {
    simularApi(rotas(operador));
    renderizarApp("/produtos");
    expect(await screen.findByText("Arroz 5kg")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo produto/ })).not.toBeInTheDocument();

    const menu = await abrirMenuDoProduto();
    expect(menu.getByRole("menuitem", { name: "Movimentar" })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Editar" })).not.toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("destaca saldo abaixo do mínimo no estoque e no status", async () => {
    simularApi(rotas(admin));
    renderizarApp("/produtos");
    const linha = await screen.findByRole("row", { name: /Arroz 5kg/ });
    expect(within(linha).getByText("4 un.")).toHaveClass("text-marca-700");
    expect(within(linha).getByText("Estoque baixo")).toBeInTheDocument();
  });

  it("mostra o status Em estoque quando o saldo está folgado", async () => {
    simularApi({
      ...rotas(admin),
      "GET /produtos": { corpo: pagina([{ ...produto, saldoAtual: 50 }]) },
    });
    renderizarApp("/produtos");
    const linha = await screen.findByRole("row", { name: /Arroz 5kg/ });
    expect(within(linha).getByText("Em estoque")).toBeInTheDocument();
    expect(within(linha).getByText("50 un.")).not.toHaveClass("text-marca-700");
  });
});
