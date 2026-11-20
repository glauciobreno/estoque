import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  admin,
  mocksDoDashboard,
  operador,
  pagina,
  renderizarApp,
  resumo,
  simularApi,
} from "../test/helpers";

afterEach(() => vi.unstubAllGlobals());

const mov = (id: number, tipo: string, quantidade: number, nome: string, dia = 20) => ({
  id,
  produtoId: id,
  produtoSku: `S-${id}`,
  produtoNome: nome,
  produtoUnidade: "un",
  tipo,
  quantidade,
  motivo: id === 2 ? "quebra" : null,
  fornecedorId: null,
  usuarioId: 1,
  usuarioNome: "Mariana Costa",
  criadoEm: `2026-11-${dia} 12:32:00`,
});

describe("movimentações", () => {
  const rotas = () =>
    simularApi({
      "GET /auth/me": { corpo: admin },
      "GET /estoque/resumo": { corpo: resumo() },
      "GET /movimentacoes/contagem": {
        corpo: { todas: 1284, entrada: 768, saida: 492, ajuste: 24 },
      },
      "GET /movimentacoes": {
        corpo: {
          items: [
            mov(1284, "entrada", 30, "Teclado mecânico K380"),
            mov(2, "saida", -8, "Mouse sem fio"),
          ],
          total: 1284,
          page: 1,
          pageSize: 10,
        },
      },
    });

  it("mostra os indicadores do mês, as abas com contagens e a tabela", async () => {
    rotas();
    renderizarApp("/movimentacoes");
    expect(await screen.findByRole("heading", { name: "Movimentações" })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Todas 1.284" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Entradas 768" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Saídas 492" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ajustes 24" })).toBeInTheDocument();
    expect(screen.getByText("Entradas no mês")).toBeInTheDocument();
    expect(screen.getByText("Ajustes de inventário")).toBeInTheDocument();

    const linha = await screen.findByRole("row", { name: /Teclado mecânico K380/ });
    expect(within(linha).getByText("#MOV-1284")).toBeInTheDocument();
    expect(within(linha).getByText("+ 30")).toHaveClass("text-sucesso");
    expect(
      within(linha).getByRole("link", { name: "Ver produto Teclado mecânico K380" }),
    ).toHaveAttribute("href", "/produtos/1284");
    expect(screen.getByText("Mostrando 1–10 de 1.284 movimentações")).toBeInTheDocument();
  });

  it("trocar de aba pede só aquele tipo, mas mantém as contagens das outras", async () => {
    const chamadas = rotas();
    renderizarApp("/movimentacoes");
    await userEvent.setup().click(await screen.findByRole("tab", { name: "Saídas 492" }));
    await waitFor(() =>
      expect(
        chamadas.some((c) => c.rota === "GET /movimentacoes" && c.consulta.get("tipo") === "saida"),
      ).toBe(true),
    );
    expect(screen.getByRole("tab", { name: "Saídas 492" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      chamadas
        .filter((c) => c.rota === "GET /movimentacoes/contagem")
        .every((c) => !c.consulta.has("tipo")),
    ).toBe(true);
  });

  it("filtra por período e oferece limpar os filtros", async () => {
    const chamadas = rotas();
    renderizarApp("/movimentacoes");
    const usuario = userEvent.setup();
    await screen.findByRole("tab", { name: "Todas 1.284" });
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText("De"), "2026-11-01");
    await waitFor(() =>
      expect(
        chamadas.some(
          (c) => c.rota === "GET /movimentacoes" && c.consulta.get("de") === "2026-11-01",
        ),
      ).toBe(true),
    );
    await usuario.click(await screen.findByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByLabelText("De")).toHaveValue("");
  });

  it("abre o formulário de nova movimentação", async () => {
    rotas();
    renderizarApp("/movimentacoes");
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "+ Nova movimentação" }));
    expect(screen.getByRole("dialog", { name: "Nova movimentação" })).toBeInTheDocument();
  });
});

describe("categorias", () => {
  const cat = (
    id: number,
    nome: string,
    totalProdutos: number,
    valorEmEstoque: number,
    emAlerta: number,
    saldoTotal = totalProdutos * 3,
  ) => ({ id, nome, totalProdutos, valorEmEstoque, emAlerta, saldoTotal });
  const items = [
    cat(1, "Eletrônicos", 78, 7482000, 3, 235),
    cat(2, "Papelaria", 48, 894000, 2),
    cat(3, "Acessórios", 36, 1431000, 4),
    cat(4, "Escritório", 24, 1248000, 0),
    cat(5, "Organização", 18, 576000, 0),
    cat(6, "Embalagens", 12, 214000, 1),
    cat(7, "Limpeza", 6, 99000, 0),
    cat(8, "Brinquedos", 1, 100, 0, 1),
  ];
  const rotas = (usuario = admin) =>
    simularApi({
      "GET /auth/me": { corpo: usuario },
      "GET /estoque/resumo": { corpo: resumo() },
      "GET /categorias/estatisticas": { corpo: { items, semCategoria: 5 } },
    });
  const nomes = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

  it("mostra o resumo e os cartões com produtos, valor e alerta", async () => {
    rotas();
    renderizarApp("/categorias");
    expect(await screen.findByText("Eletrônicos")).toBeInTheDocument();
    expect(screen.getByText("categorias no total").previousSibling).toHaveTextContent("8");
    expect(screen.getByText("produtos organizados").previousSibling).toHaveTextContent("223");
    expect(screen.getByText("produtos sem categoria").previousSibling).toHaveTextContent("5");

    const cartao = screen.getByText("Eletrônicos").closest("li")!;
    expect(within(cartao).getByText("78 produtos")).toBeInTheDocument();
    expect(within(cartao).getByText(/R\$\s*74\.820/)).toBeInTheDocument();
    expect(within(cartao).getByText("235 unidades em estoque")).toBeInTheDocument();
    expect(within(cartao).getByText("● 3 produtos em alerta")).toHaveClass("text-marca-700");
    expect(within(cartao).getByRole("link", { name: "Ver produtos →" })).toHaveAttribute(
      "href",
      "/produtos?categoria=1",
    );
    expect(
      within(screen.getByText("Escritório").closest("li")!).getByText("● Estoque saudável"),
    ).toHaveClass("text-sucesso");
  });

  it("singulariza quando há um só produto ou uma só unidade", async () => {
    rotas();
    renderizarApp("/categorias");
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Carregar mais categorias ↓" }));
    const cartao = screen.getByText("Brinquedos").closest("li")!;
    expect(within(cartao).getByText("1 produto")).toBeInTheDocument();
    expect(within(cartao).getByText("1 unidade em estoque")).toBeInTheDocument();
  });

  it("mostra 6 por vez e carrega mais", async () => {
    rotas();
    renderizarApp("/categorias");
    await screen.findByText("Eletrônicos");
    expect(nomes()).toHaveLength(6);
    expect(screen.getByText("Mostrando 6 de 8 categorias")).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Carregar mais categorias ↓" }));
    expect(nomes()).toHaveLength(8);
    expect(screen.getByText("Mostrando 8 de 8 categorias")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Carregar mais categorias ↓" }),
    ).not.toBeInTheDocument();
  });

  it("ordena por produtos, nome ou valor", async () => {
    rotas();
    renderizarApp("/categorias");
    await screen.findByText("Eletrônicos");
    expect(nomes().slice(0, 3)).toEqual(["Eletrônicos", "Papelaria", "Acessórios"]); // mais produtos

    const usuario = userEvent.setup();
    await usuario.selectOptions(screen.getByRole("combobox", { name: "Ordenação" }), "Nome (A–Z)");
    expect(nomes().slice(0, 3)).toEqual(["Acessórios", "Brinquedos", "Eletrônicos"]);

    await usuario.selectOptions(
      screen.getByRole("combobox", { name: "Ordenação" }),
      "Maior valor em estoque",
    );
    expect(nomes().slice(0, 3)).toEqual(["Eletrônicos", "Acessórios", "Escritório"]);
  });

  it("busca por nome e avisa quando nada é encontrado", async () => {
    rotas();
    renderizarApp("/categorias");
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("Buscar categoria"), "pap");
    await waitFor(() => expect(nomes()).toEqual(["Papelaria"]));
    await usuario.clear(screen.getByLabelText("Buscar categoria"));
    await usuario.type(screen.getByLabelText("Buscar categoria"), "zzz");
    expect(await screen.findByText("Nenhuma categoria encontrada.")).toBeInTheDocument();
  });

  it("só o administrador cria, edita e exclui", async () => {
    rotas(operador);
    renderizarApp("/categorias");
    await screen.findByText("Eletrônicos");
    expect(screen.queryByRole("button", { name: "+ Nova categoria" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ações de/ })).not.toBeInTheDocument();
  });

  it("o administrador cria uma categoria pelo botão", async () => {
    const chamadas = simularApi({
      "GET /auth/me": { corpo: admin },
      "GET /estoque/resumo": { corpo: resumo() },
      "GET /categorias/estatisticas": { corpo: { items, semCategoria: 0 } },
      "POST /categorias": { status: 201, corpo: { id: 9, nome: "Nova" } },
    });
    renderizarApp("/categorias");
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "+ Nova categoria" }));
    const dialogo = screen.getByRole("dialog", { name: "Nova categoria" });
    await usuario.type(within(dialogo).getByLabelText("Nome"), "Nova");
    await usuario.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.rota === "POST /categorias")?.corpo).toEqual({ nome: "Nova" }),
    );
  });
});

describe("fornecedores", () => {
  const rotas = (usuario = admin) =>
    simularApi({
      "GET /auth/me": { corpo: usuario },
      "GET /estoque/resumo": { corpo: resumo() },
      "GET /fornecedores": {
        corpo: {
          items: [
            { id: 1, nome: "Tech Brasil", contato: "Camila · vendas@techbrasil.com.br" },
            { id: 2, nome: "Sem Entradas", contato: null },
          ],
          total: 2,
          page: 1,
          pageSize: 8,
        },
      },
      "GET /fornecedores/estatisticas": {
        corpo: {
          items: [
            {
              id: 1,
              entradas: 3,
              produtos: 2,
              unidades: 509,
              ultimaEntrada: "2026-11-20 12:00:00",
            },
            { id: 2, entradas: 0, produtos: 0, unidades: 0, ultimaEntrada: null },
          ],
          entradasNoMes: 11,
        },
      },
    });

  it("junta o cadastro com as estatísticas de entradas", async () => {
    rotas();
    renderizarApp("/fornecedores");
    const linha = await screen.findByRole("row", { name: /Tech Brasil/ });
    expect(within(linha).getByText("Camila · vendas@techbrasil.com.br")).toBeInTheDocument();
    expect(within(linha).getByText("2 produtos")).toBeInTheDocument();
    expect(within(linha).getByText("3 (509 un.)")).toBeInTheDocument();
    expect(within(linha).getByText(/^20 nov$/)).toBeInTheDocument();

    const semEntradas = screen.getByRole("row", { name: /Sem Entradas/ });
    expect(within(semEntradas).getByText("0 produtos")).toBeInTheDocument();
    expect(within(semEntradas).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("mostra os indicadores", async () => {
    rotas();
    renderizarApp("/fornecedores");
    expect(await screen.findByText("Fornecedores cadastrados")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("de 2 cadastrados")).toBeInTheDocument());
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Com entradas registradas")).toBeInTheDocument();
  });

  it("a busca vira parâmetro da API", async () => {
    const chamadas = rotas();
    renderizarApp("/fornecedores");
    await userEvent.setup().type(await screen.findByLabelText("Buscar fornecedores"), "tech");
    await waitFor(() =>
      expect(
        chamadas.some((c) => c.rota === "GET /fornecedores" && c.consulta.get("q") === "tech"),
      ).toBe(true),
    );
  });

  it("operador não vê as ações de cadastro", async () => {
    rotas(operador);
    renderizarApp("/fornecedores");
    await screen.findByRole("row", { name: /Tech Brasil/ });
    expect(screen.queryByRole("button", { name: "+ Novo fornecedor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ações de/ })).not.toBeInTheDocument();
  });

  it("o administrador edita pelo menu e vê o formulário preenchido", async () => {
    rotas();
    renderizarApp("/fornecedores");
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Ações de Tech Brasil" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialogo = screen.getByRole("dialog", { name: "Editar fornecedor" });
    expect(within(dialogo).getByLabelText("Nome")).toHaveValue("Tech Brasil");
    expect(within(dialogo).getByLabelText("Contato")).toHaveValue(
      "Camila · vendas@techbrasil.com.br",
    );
  });
});

describe("topo do layout", () => {
  const base = (parcial = {}) =>
    simularApi({
      "GET /auth/me": { corpo: admin },
      ...mocksDoDashboard({ produtosAtivos: 10, produtosInativos: 3, ...parcial }),
      "GET /produtos": { corpo: pagina([]) },
      "GET /categorias": { corpo: pagina([]) },
    });

  it("mostra a marca, o nome do sistema e o rodapé", async () => {
    base();
    renderizarApp("/");
    expect(await screen.findByRole("img", { name: "Sistema de Estoque" })).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()} Sistema de Estoque`)),
    ).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("mostra a quantidade de produtos cadastrados no menu", async () => {
    base();
    renderizarApp("/");
    const menu = await screen.findByRole("navigation", { name: "Principal" });
    const link = within(menu).getByRole("link", { name: /^Produtos/ });
    await waitFor(() => expect(within(link).getByText("13")).toBeInTheDocument());
  });

  it("o sino leva aos produtos em alerta e só tem ponto quando há alerta", async () => {
    base({ abaixoDoMinimo: 4 });
    const { unmount } = renderizarApp("/");
    const sino = await screen.findByRole("link", { name: "Produtos com estoque baixo" });
    expect(sino).toHaveAttribute("href", "/produtos?aba=baixo");
    await waitFor(() => expect(sino.querySelector(".bg-marca-600")).not.toBeNull());
    unmount();

    base({ abaixoDoMinimo: 0 });
    renderizarApp("/");
    const semAlerta = await screen.findByRole("link", { name: "Produtos com estoque baixo" });
    await screen.findByText("0 produtos");
    expect(semAlerta.querySelector(".bg-marca-600")).toBeNull();
  });

  it("a busca global leva ao catálogo filtrado", async () => {
    const chamadas = base();
    renderizarApp("/");
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByRole("searchbox", { name: "Buscar no estoque" }),
      "teclado{Enter}",
    );
    expect(await screen.findByRole("heading", { name: "Produtos" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        chamadas.some((c) => c.rota === "GET /produtos" && c.consulta.get("q") === "teclado"),
      ).toBe(true),
    );
  });

  it("Ctrl+K foca a busca global", async () => {
    base();
    renderizarApp("/");
    const campo = await screen.findByRole("searchbox", { name: "Buscar no estoque" });
    expect(campo).not.toHaveFocus();
    await userEvent.setup().keyboard("{Control>}k{/Control}");
    expect(campo).toHaveFocus();
  });

  it("o breadcrumb acompanha a página atual", async () => {
    base();
    renderizarApp("/categorias");
    const trilha = await screen.findByRole("navigation", { name: "Você está em" });
    expect(within(trilha).getByText("Categorias")).toBeInTheDocument();
    expect(within(trilha).getByText("Minha empresa")).toBeInTheDocument();
  });
});
