import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, mocksDoDashboard, operador, renderizarApp, simularApi } from "../test/helpers";

afterEach(() => vi.unstubAllGlobals());

const futuro = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
const passado = new Date(Date.now() - 3600 * 1000).toISOString();
const base = {
  criadoEm: "2026-01-01 00:00:00",
  conviteExpiraEm: null,
  pendente: false,
  ativo: true,
};

const lista = [
  { ...base, id: 1, nome: "Ana Admin", email: "ana@x.com", papel: "admin" },
  { ...base, id: 2, nome: "Beto Operador", email: "beto@x.com", papel: "operador" },
  {
    ...base,
    id: 3,
    nome: "Carla Pendente",
    email: "carla@x.com",
    papel: "operador",
    pendente: true,
    conviteExpiraEm: futuro,
  },
  {
    ...base,
    id: 4,
    nome: "Davi Vencido",
    email: "davi@x.com",
    papel: "operador",
    pendente: true,
    conviteExpiraEm: passado,
  },
  { ...base, id: 5, nome: "Eva Inativa", email: "eva@x.com", papel: "operador", ativo: false },
];
const dashboard = mocksDoDashboard();
const linha = (nome: string) => screen.getByRole("row", { name: new RegExp(nome) });

async function abrirMenu(usuario: ReturnType<typeof userEvent.setup>, nome: string) {
  const botao = within(await screen.findByRole("row", { name: new RegExp(nome) })).getByRole(
    "button",
    {
      name: /^Ações de/,
    },
  );
  await usuario.click(botao);
  return within(screen.getByRole("menu"));
}

describe("tela de usuários", () => {
  it("mostra a situação de cada pessoa", async () => {
    simularApi({ "GET /auth/me": { corpo: admin }, "GET /usuarios": { corpo: { items: lista } } });
    renderizarApp("/usuarios");
    await screen.findByText("Carla Pendente");

    expect(within(linha("Beto")).getByText("Ativo")).toBeInTheDocument();
    expect(within(linha("Carla")).getByText("Pendente")).toBeInTheDocument();
    expect(within(linha("Carla")).getByText(/Link válido até/)).toBeInTheDocument();
    expect(within(linha("Davi")).getByText("Link expirado")).toBeInTheDocument();
    expect(within(linha("Eva")).getByText("Inativo")).toBeInTheDocument();
  });

  it("o administrador não pode se desativar, e cada situação tem as ações certas", async () => {
    simularApi({ "GET /auth/me": { corpo: admin }, "GET /usuarios": { corpo: { items: lista } } });
    renderizarApp("/usuarios");
    await screen.findByText("Carla Pendente");
    expect(within(linha("Ana Admin")).getByText("(você)")).toBeInTheDocument();
    const usuario = userEvent.setup();

    const menuDeAna = await abrirMenu(usuario, "Ana Admin");
    expect(menuDeAna.getByRole("menuitem", { name: "Redefinir senha" })).toBeInTheDocument();
    expect(menuDeAna.queryByRole("menuitem", { name: "Desativar" })).not.toBeInTheDocument();
    await usuario.keyboard("{Escape}");

    const menuDeBeto = await abrirMenu(usuario, "Beto");
    expect(menuDeBeto.getByRole("menuitem", { name: "Desativar" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");

    const menuDeCarla = await abrirMenu(usuario, "Carla");
    expect(menuDeCarla.getByRole("menuitem", { name: "Novo link" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");

    const menuDeEva = await abrirMenu(usuario, "Eva");
    expect(menuDeEva.getByRole("menuitem", { name: "Reativar" })).toBeInTheDocument();
    expect(menuDeEva.queryByRole("menuitem", { name: "Redefinir senha" })).not.toBeInTheDocument();
  });

  it("convite pendente tem o atalho Reenviar na linha", async () => {
    simularApi({ "GET /auth/me": { corpo: admin }, "GET /usuarios": { corpo: { items: lista } } });
    renderizarApp("/usuarios");
    await screen.findByText("Carla Pendente");
    expect(within(linha("Carla")).getByRole("button", { name: "Reenviar" })).toBeInTheDocument();
    expect(
      within(linha("Beto")).queryByRole("button", { name: "Reenviar" }),
    ).not.toBeInTheDocument();
  });

  it("cria o usuário só com nome e e-mail e mostra o link uma vez", async () => {
    const chamadas = simularApi({
      "GET /auth/me": { corpo: admin },
      "GET /usuarios": { corpo: { items: lista } },
      "POST /usuarios": {
        status: 201,
        corpo: {
          usuario: {
            ...base,
            id: 9,
            nome: "Fábio Novo",
            email: "fabio@x.com",
            papel: "operador",
            pendente: true,
            conviteExpiraEm: futuro,
          },
          convite: { token: "T".repeat(43), expiraEm: futuro },
        },
      },
    });
    renderizarApp("/usuarios");
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "+ Novo usuário" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).queryByLabelText(/senha/i)).not.toBeInTheDocument();

    await usuario.type(within(dialogo).getByLabelText("Nome"), "Fábio Novo");
    await usuario.type(within(dialogo).getByLabelText("E-mail"), "fabio@x.com");
    await usuario.click(within(dialogo).getByRole("button", { name: "Criar e gerar link" }));

    const modalLink = await screen.findByRole("dialog", { name: "Link de primeiro acesso" });
    expect(within(modalLink).getByLabelText("Link de acesso")).toHaveValue(
      `${window.location.origin}/ativar#${"T".repeat(43)}`,
    );
    expect(within(modalLink).getByText(/só funciona uma vez/)).toBeInTheDocument();
    expect(chamadas.find((c) => c.rota === "POST /usuarios")?.corpo).toEqual({
      nome: "Fábio Novo",
      email: "fabio@x.com",
      papel: "operador",
    });
  });

  it("valida e-mail antes de criar", async () => {
    const chamadas = simularApi({
      "GET /auth/me": { corpo: admin },
      "GET /usuarios": { corpo: { items: lista } },
    });
    renderizarApp("/usuarios");
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "+ Novo usuário" }));
    const dialogo = screen.getByRole("dialog");
    await usuario.type(within(dialogo).getByLabelText("Nome"), "Sem Email");
    await usuario.type(within(dialogo).getByLabelText("E-mail"), "invalido");
    await usuario.click(within(dialogo).getByRole("button", { name: "Criar e gerar link" }));
    expect(await within(dialogo).findByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(chamadas.some((c) => c.rota === "POST /usuarios")).toBe(false);
  });

  it("redefinir senha gera um novo link", async () => {
    simularApi({
      "GET /auth/me": { corpo: admin },
      "GET /usuarios": { corpo: { items: lista } },
      "POST /usuarios/2/convite": {
        corpo: { usuario: lista[1], convite: { token: "R".repeat(43), expiraEm: futuro } },
      },
    });
    renderizarApp("/usuarios");
    const usuario = userEvent.setup();
    const menu = await abrirMenu(usuario, "Beto");
    await usuario.click(menu.getByRole("menuitem", { name: "Redefinir senha" }));
    const modal = await screen.findByRole("dialog", { name: "Link para redefinir a senha" });
    expect(within(modal).getByText(/senha atual continua valendo/)).toBeInTheDocument();
  });

  it("desativar pede confirmação e avisa o efeito imediato", async () => {
    const chamadas = simularApi({
      "GET /auth/me": { corpo: admin },
      "GET /usuarios": { corpo: { items: lista } },
      "PATCH /usuarios/2": { corpo: { ...lista[1], ativo: false } },
    });
    renderizarApp("/usuarios");
    const usuario = userEvent.setup();
    const menu = await abrirMenu(usuario, "Beto");
    await usuario.click(menu.getByRole("menuitem", { name: "Desativar" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/perde o acesso imediatamente/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole("button", { name: "Desativar" }));
    await screen.findByText("Beto Operador");
    expect(chamadas.find((c) => c.rota === "PATCH /usuarios/2")?.corpo).toEqual({ ativo: false });
  });
});

describe("permissões", () => {
  it("o operador não vê o menu Usuários e é redirecionado se abrir a rota", async () => {
    simularApi({ "GET /auth/me": { corpo: operador }, ...dashboard });
    renderizarApp("/usuarios");
    expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
  });

  it("o administrador vê o menu Usuários", async () => {
    simularApi({ "GET /auth/me": { corpo: admin }, ...dashboard });
    renderizarApp("/");
    expect(await screen.findByRole("link", { name: "Usuários" })).toBeInTheDocument();
  });
});

describe("alterar a própria senha", () => {
  async function abrir() {
    const chamadas = simularApi({
      "GET /auth/me": { corpo: operador },
      ...dashboard,
      "POST /auth/senha": { status: 204 },
    });
    renderizarApp("/");
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Alterar senha" }));
    return { chamadas, usuario, dialogo: screen.getByRole("dialog", { name: "Alterar senha" }) };
  }

  it("valida a confirmação e o tamanho", async () => {
    const { chamadas, usuario, dialogo } = await abrir();
    await usuario.type(within(dialogo).getByLabelText("Senha atual"), "antiga");
    await usuario.type(within(dialogo).getByLabelText("Nova senha"), "nova-senha-comprida");
    await usuario.type(within(dialogo).getByLabelText("Confirmar nova senha"), "diferente-da-nova");
    await usuario.click(within(dialogo).getByRole("button", { name: "Alterar senha" }));
    expect(await within(dialogo).findByText("As senhas não conferem")).toBeInTheDocument();
    expect(chamadas.some((c) => c.rota === "POST /auth/senha")).toBe(false);
  });

  it("envia a senha atual e a nova e confirma o sucesso", async () => {
    const { chamadas, usuario, dialogo } = await abrir();
    await usuario.type(within(dialogo).getByLabelText("Senha atual"), "antiga");
    await usuario.type(within(dialogo).getByLabelText("Nova senha"), "nova-senha-comprida");
    await usuario.type(
      within(dialogo).getByLabelText("Confirmar nova senha"),
      "nova-senha-comprida",
    );
    await usuario.click(within(dialogo).getByRole("button", { name: "Alterar senha" }));
    expect(await within(dialogo).findByRole("status")).toHaveTextContent(
      "Senha alterada com sucesso",
    );
    expect(chamadas.find((c) => c.rota === "POST /auth/senha")?.corpo).toEqual({
      senhaAtual: "antiga",
      novaSenha: "nova-senha-comprida",
    });
  });
});
