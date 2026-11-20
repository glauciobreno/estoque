import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, mocksDoDashboard, renderizarApp, simularApi } from "../test/helpers";

afterEach(() => vi.unstubAllGlobals());

const semSessao = { "GET /auth/me": { status: 401, corpo: { erro: "Não autenticado" } } };

describe("autenticação na interface", () => {
  it("redireciona para o login quando não há sessão", async () => {
    simularApi(semSessao);
    renderizarApp("/produtos");
    expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("mostra o erro do servidor quando as credenciais estão erradas", async () => {
    simularApi({
      ...semSessao,
      "POST /auth/login": { status: 401, corpo: { erro: "E-mail ou senha inválidos" } },
    });
    renderizarApp("/login");
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("E-mail"), "ana@x.com");
    await usuario.type(screen.getByLabelText("Senha"), "errada");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos");
  });

  it("valida o formulário antes de chamar a API", async () => {
    const chamadas = simularApi(semSessao);
    renderizarApp("/login");
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("e-mail válido");
    expect(chamadas.some((c) => c.rota === "POST /auth/login")).toBe(false);
  });

  it("entra e abre o dashboard", async () => {
    simularApi({
      ...semSessao,
      "POST /auth/login": { corpo: admin },
      ...mocksDoDashboard({ produtosAtivos: 3, valorEmEstoque: 123456 }),
    });
    renderizarApp("/login");
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("E-mail"), "ana@x.com");
    await usuario.type(screen.getByLabelText("Senha"), "admin123");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/R\$\s*1\.235/)).toBeInTheDocument());
    expect(screen.getByText(/Nenhum produto abaixo do mínimo/)).toBeInTheDocument();
  });
});

describe("sessão expirada", () => {
  it("volta ao login com aviso quando uma rota protegida responde 401", async () => {
    let autenticado = true;
    simularApi({
      "GET /auth/me": () =>
        autenticado ? { corpo: admin } : { status: 401, corpo: { erro: "Não autenticado" } },
      "GET /estoque/resumo": () => {
        autenticado = false;
        return { status: 401, corpo: { erro: "Não autenticado" } };
      },
      "GET /estoque/alertas": { status: 401, corpo: { erro: "Não autenticado" } },
      "GET /movimentacoes": { status: 401, corpo: { erro: "Não autenticado" } },
      "GET /estoque/fluxo": { status: 401, corpo: { erro: "Não autenticado" } },
    });
    renderizarApp("/");
    expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sua sessão expirou");
  });
});
