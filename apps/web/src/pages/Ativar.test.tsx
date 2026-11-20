import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, renderizarApp, simularApi } from "../test/helpers";

afterEach(() => vi.unstubAllGlobals());

const TOKEN = "t".repeat(43);
const semSessao = { "GET /auth/me": { status: 401, corpo: { erro: "Não autenticado" } } };
const dashboard = {
  "GET /estoque/resumo": {
    corpo: { produtosAtivos: 0, valorEmEstoque: 0, abaixoDoMinimo: 0, semEstoque: 0 },
  },
  "GET /estoque/alertas": { corpo: { items: [], total: 0, page: 1, pageSize: 8 } },
  "GET /movimentacoes": { corpo: { items: [], total: 0, page: 1, pageSize: 8 } },
};
const conviteValido = {
  "POST /auth/convite/verificar": {
    corpo: { nome: "Carla Souza", email: "carla@x.com", redefinicao: false },
  },
};

describe("página de primeiro acesso", () => {
  it("cumprimenta a pessoa e mostra o e-mail da conta", async () => {
    simularApi({ ...semSessao, ...conviteValido });
    renderizarApp(`/ativar#${TOKEN}`);
    expect(
      await screen.findByRole("heading", { name: "Bem-vindo(a), Carla Souza" }),
    ).toBeInTheDocument();
    expect(screen.getByText("carla@x.com")).toBeInTheDocument();
  });

  it("envia o token no corpo da requisição, não na URL", async () => {
    const chamadas = simularApi({ ...semSessao, ...conviteValido });
    renderizarApp(`/ativar#${TOKEN}`);
    await screen.findByRole("heading", { name: /Bem-vindo/ });
    const verificacao = chamadas.find((c) => c.rota === "POST /auth/convite/verificar");
    expect(verificacao?.corpo).toEqual({ token: TOKEN });
    expect(chamadas.every((c) => !c.rota.includes(TOKEN))).toBe(true);
  });

  it("explica quando o link é inválido ou expirou", async () => {
    simularApi({
      ...semSessao,
      "POST /auth/convite/verificar": {
        status: 400,
        corpo: { erro: "Convite inválido ou expirado" },
      },
    });
    renderizarApp(`/ativar#${TOKEN}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("inválido ou expirou");
    expect(screen.getByRole("link", { name: "Ir para o login" })).toBeInTheDocument();
  });

  it("sem token na URL, nem consulta a API", async () => {
    const chamadas = simularApi({ ...semSessao });
    renderizarApp("/ativar");
    expect(await screen.findByRole("alert")).toHaveTextContent("inválido ou expirou");
    expect(chamadas.some((c) => c.rota.includes("convite"))).toBe(false);
  });

  it("valida o tamanho e a confirmação antes de enviar", async () => {
    const chamadas = simularApi({ ...semSessao, ...conviteValido });
    renderizarApp(`/ativar#${TOKEN}`);
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("Senha"), "curta");
    await usuario.type(screen.getByLabelText("Confirmar senha"), "curta");
    await usuario.click(screen.getByRole("button", { name: "Definir senha e entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 10 caracteres");

    await usuario.clear(screen.getByLabelText("Senha"));
    await usuario.type(screen.getByLabelText("Senha"), "senha-bem-comprida");
    await usuario.click(screen.getByRole("button", { name: "Definir senha e entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não conferem");
    expect(chamadas.some((c) => c.rota === "POST /auth/convite/aceitar")).toBe(false);
  });

  it("define a senha e já entra no sistema", async () => {
    const chamadas = simularApi({
      ...semSessao,
      ...conviteValido,
      ...dashboard,
      "POST /auth/convite/aceitar": {
        corpo: { ...admin, id: 7, nome: "Carla Souza", papel: "operador" },
      },
    });
    renderizarApp(`/ativar#${TOKEN}`);
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("Senha"), "senha-bem-comprida");
    await usuario.type(screen.getByLabelText("Confirmar senha"), "senha-bem-comprida");
    await usuario.click(screen.getByRole("button", { name: "Definir senha e entrar" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(chamadas.find((c) => c.rota === "POST /auth/convite/aceitar")?.corpo).toEqual({
      token: TOKEN,
      senha: "senha-bem-comprida",
    });
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
    // Entrou direto: não passou pela tela de login, então o Dashboard carregou uma única vez.
    expect(chamadas.filter((c) => c.rota === "GET /estoque/resumo")).toHaveLength(1);
  });

  it("mostra o erro do servidor, por exemplo senha recusada", async () => {
    simularApi({
      ...semSessao,
      ...conviteValido,
      "POST /auth/convite/aceitar": {
        status: 400,
        corpo: { erro: "Convite inválido ou expirado" },
      },
    });
    renderizarApp(`/ativar#${TOKEN}`);
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("Senha"), "senha-bem-comprida");
    await usuario.type(screen.getByLabelText("Confirmar senha"), "senha-bem-comprida");
    await usuario.click(screen.getByRole("button", { name: "Definir senha e entrar" }));
    expect(await screen.findByText("Convite inválido ou expirado")).toBeInTheDocument();
  });

  it("no link de redefinição, avisa que é uma nova senha", async () => {
    simularApi({
      ...semSessao,
      "POST /auth/convite/verificar": {
        corpo: { nome: "Carla Souza", email: "carla@x.com", redefinicao: true },
      },
    });
    renderizarApp(`/ativar#${TOKEN}`);
    expect(await screen.findByRole("heading", { name: "Redefinir senha" })).toBeInTheDocument();
  });
});
