import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp, login, type App } from "./helpers.js";

let app: App;
let admin: string;
let operador: string;

beforeAll(async () => {
  app = await criarApp();
  admin = (await login(app, "admin@x.com", "admin123")).cookie;
  operador = (await login(app, "op@x.com", "op12345")).cookie;
});
afterAll(() => app.close());

const req = (method: "GET" | "POST" | "PUT", url: string, cookie?: string, payload?: object) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

let seq = 0;
async function novoProduto(extra: object = {}) {
  const res = await req("POST", "/produtos", admin, {
    sku: `MOV-${++seq}`,
    nome: `Item ${seq}`,
    ...extra,
  });
  return res.json() as { id: number; saldoAtual: number };
}
const mover = (cookie: string, payload: object) => req("POST", "/movimentacoes", cookie, payload);
const saldo = async (id: number) => (await req("GET", `/produtos/${id}`, admin)).json().saldoAtual;

describe("registro de movimentações", () => {
  it("exige autenticação, mas operador pode movimentar", async () => {
    const p = await novoProduto();
    expect((await mover("", { tipo: "entrada", produtoId: p.id, quantidade: 1 })).statusCode).toBe(
      401,
    );
    const res = await mover(operador, { tipo: "entrada", produtoId: p.id, quantidade: 10 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      saldoAtual: 10,
      movimentacao: { quantidade: 10, usuarioId: 2 },
    });
  });

  it("entrada e saída atualizam o saldo", async () => {
    const p = await novoProduto();
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 20, motivo: "compra" });
    const saida = await mover(admin, { tipo: "saida", produtoId: p.id, quantidade: 8 });
    expect(saida.json()).toMatchObject({ saldoAtual: 12, movimentacao: { quantidade: -8 } });
    expect(await saldo(p.id)).toBe(12);
  });

  it("bloqueia saída maior que o saldo sem gravar nada", async () => {
    const p = await novoProduto();
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 3 });
    const res = await mover(admin, { tipo: "saida", produtoId: p.id, quantidade: 4 });
    expect(res.statusCode).toBe(409);
    expect(await saldo(p.id)).toBe(3);
    const hist = (await req("GET", `/produtos/${p.id}/movimentacoes`, admin)).json();
    expect(hist.total).toBe(1);
  });

  it("ajuste leva o saldo ao valor contado e exige motivo", async () => {
    const p = await novoProduto();
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 10 });
    expect((await mover(admin, { tipo: "ajuste", produtoId: p.id, novoSaldo: 7 })).statusCode).toBe(
      400,
    );
    const res = await mover(admin, {
      tipo: "ajuste",
      produtoId: p.id,
      novoSaldo: 7,
      motivo: "quebra",
    });
    expect(res.json()).toMatchObject({
      saldoAtual: 7,
      movimentacao: { tipo: "ajuste", quantidade: -3 },
    });
  });

  it("valida quantidades e tipos", async () => {
    const p = await novoProduto();
    for (const payload of [
      { tipo: "entrada", produtoId: p.id, quantidade: 0 },
      { tipo: "entrada", produtoId: p.id, quantidade: 1.5 },
      { tipo: "saida", produtoId: p.id, quantidade: -2 },
      { tipo: "transferencia", produtoId: p.id, quantidade: 1 },
    ]) {
      expect((await mover(admin, payload)).statusCode).toBe(400);
    }
  });

  it("recusa produto inexistente, inativo e fornecedor inexistente", async () => {
    expect(
      (await mover(admin, { tipo: "entrada", produtoId: 9999, quantidade: 1 })).statusCode,
    ).toBe(404);

    const inativo = await novoProduto({ ativo: false });
    expect(
      (await mover(admin, { tipo: "entrada", produtoId: inativo.id, quantidade: 1 })).statusCode,
    ).toBe(409);

    const p = await novoProduto();
    const res = await mover(admin, {
      tipo: "entrada",
      produtoId: p.id,
      quantidade: 1,
      fornecedorId: 999,
    });
    expect(res.statusCode).toBe(400);
    expect(await saldo(p.id)).toBe(0);
  });

  it("registra o fornecedor da entrada", async () => {
    const f = (await req("POST", "/fornecedores", admin, { nome: "Acme" })).json();
    const p = await novoProduto();
    const res = await mover(admin, {
      tipo: "entrada",
      produtoId: p.id,
      quantidade: 5,
      fornecedorId: f.id,
    });
    expect(res.json().movimentacao.fornecedorId).toBe(f.id);
  });

  it("não permite editar nem excluir movimentações", async () => {
    expect((await req("PUT", "/movimentacoes/1", admin, {})).statusCode).toBe(404);
    const res = await app.inject({
      method: "DELETE",
      url: "/movimentacoes/1",
      headers: { cookie: admin },
    });
    expect(res.statusCode).toBe(404);
  });

  it("produto com movimentações não pode ser excluído", async () => {
    const p = await novoProduto();
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 1 });
    const res = await app.inject({
      method: "DELETE",
      url: `/produtos/${p.id}`,
      headers: { cookie: admin },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe("consistência", () => {
  it("o saldo é sempre a soma das movimentações", async () => {
    const p = await novoProduto();
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 50 });
    await mover(admin, { tipo: "saida", produtoId: p.id, quantidade: 12 });
    await mover(admin, { tipo: "ajuste", produtoId: p.id, novoSaldo: 30, motivo: "contagem" });
    await mover(admin, { tipo: "saida", produtoId: p.id, quantidade: 5 });

    const { items } = (
      await req("GET", `/produtos/${p.id}/movimentacoes?pageSize=100`, admin)
    ).json();
    const soma = items.reduce((acc: number, m: { quantidade: number }) => acc + m.quantidade, 0);
    expect(soma).toBe(25);
    expect(await saldo(p.id)).toBe(25);
  });

  it("saídas simultâneas nunca deixam o saldo negativo", async () => {
    const p = await novoProduto();
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 5 });

    const respostas = await Promise.all(
      Array.from({ length: 12 }, () =>
        mover(admin, { tipo: "saida", produtoId: p.id, quantidade: 1 }),
      ),
    );
    const ok = respostas.filter((r) => r.statusCode === 201).length;
    expect(ok).toBe(5);
    expect(respostas.filter((r) => r.statusCode === 409)).toHaveLength(7);
    expect(await saldo(p.id)).toBe(0);
  });
});

describe("histórico e alertas", () => {
  it("lista o histórico por produto, mais recente primeiro, com filtros", async () => {
    const p = await novoProduto();
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 10 });
    await mover(admin, { tipo: "saida", produtoId: p.id, quantidade: 2 });

    const hist = (await req("GET", `/produtos/${p.id}/movimentacoes`, admin)).json();
    expect(hist.total).toBe(2);
    expect(hist.items[0]).toMatchObject({
      tipo: "saida",
      quantidade: -2,
      usuarioNome: "Admin",
      produtoSku: expect.any(String),
    });

    const soSaidas = (
      await req("GET", `/movimentacoes?produtoId=${p.id}&tipo=saida`, admin)
    ).json();
    expect(soSaidas.total).toBe(1);

    const hoje = new Date().toISOString().slice(0, 10);
    expect(
      (await req("GET", `/movimentacoes?produtoId=${p.id}&de=${hoje}&ate=${hoje}`, admin)).json()
        .total,
    ).toBe(2);
    expect(
      (await req("GET", `/movimentacoes?produtoId=${p.id}&ate=2000-01-01`, admin)).json().total,
    ).toBe(0);
    expect((await req("GET", `/movimentacoes?de=ontem`, admin)).statusCode).toBe(400);
    expect((await req("GET", "/produtos/9999/movimentacoes", admin)).statusCode).toBe(404);
  });

  it("alerta produtos ativos com saldo igual ou abaixo do mínimo", async () => {
    const baixo = await novoProduto({ estoqueMinimo: 5 });
    await mover(admin, { tipo: "entrada", produtoId: baixo.id, quantidade: 5 });
    const folgado = await novoProduto({ estoqueMinimo: 5 });
    await mover(admin, { tipo: "entrada", produtoId: folgado.id, quantidade: 6 });
    const semMinimo = await novoProduto();
    const inativo = await novoProduto({ estoqueMinimo: 5, ativo: false });

    const { items } = (await req("GET", "/estoque/alertas?pageSize=100", admin)).json();
    const ids = items.map((i: { id: number }) => i.id);
    expect(ids).toContain(baixo.id);
    expect(ids).not.toContain(folgado.id);
    expect(ids).not.toContain(semMinimo.id);
    expect(ids).not.toContain(inativo.id);

    await mover(admin, { tipo: "entrada", produtoId: baixo.id, quantidade: 1 });
    const depois = (await req("GET", "/estoque/alertas?pageSize=100", admin)).json();
    expect(depois.items.map((i: { id: number }) => i.id)).not.toContain(baixo.id);
  });

  it("resume o estoque: valor a preço de custo, alertas e itens zerados", async () => {
    const antes = (await req("GET", "/estoque/resumo", admin)).json();

    const p = await novoProduto({ precoCusto: 250, estoqueMinimo: 10 });
    await mover(admin, { tipo: "entrada", produtoId: p.id, quantidade: 4 });
    await novoProduto({ ativo: false, precoCusto: 99999 });

    const depois = (await req("GET", "/estoque/resumo", admin)).json();
    expect(depois.produtosAtivos).toBe(antes.produtosAtivos + 1);
    expect(depois.valorEmEstoque).toBe(antes.valorEmEstoque + 4 * 250);
    expect(depois.abaixoDoMinimo).toBe(antes.abaixoDoMinimo + 1);
    expect((await req("GET", "/estoque/resumo")).statusCode).toBe(401);
  });
});
