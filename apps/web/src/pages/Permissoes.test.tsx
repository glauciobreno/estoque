import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, operador, pagina, renderizarApp, simularApi } from "../test/helpers";

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
});

describe("permissões na interface", () => {
  it("admin vê as ações de cadastro", async () => {
    simularApi(rotas(admin));
    renderizarApp("/produtos");
    expect(await screen.findByText("Arroz 5kg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo produto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });

  it("operador só consegue movimentar", async () => {
    simularApi(rotas(operador));
    renderizarApp("/produtos");
    expect(await screen.findByText("Arroz 5kg")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo produto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Movimentar" })).toBeInTheDocument();
  });

  it("destaca saldo abaixo do mínimo", async () => {
    simularApi(rotas(admin));
    renderizarApp("/produtos");
    expect(await screen.findByText("4 un")).toHaveClass("bg-amber-100");
  });
});
