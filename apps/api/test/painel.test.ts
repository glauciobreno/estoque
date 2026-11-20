import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/db/client.js";
import { movimentacoes } from "../src/db/schema.js";
import { criarApp, login, type App } from "./helpers.js";

let app: App;
let db: ReturnType<typeof createDb>;
let admin: string;

beforeEach(async () => {
  db = createDb(":memory:");
  app = await criarApp({}, db);
  admin = (await login(app, "admin@x.com", "admin123")).cookie;
});
afterEach(() => app.close());

const req = (
  method: "GET" | "POST",
  url: string,
  payload?: object,
  cookie: string | null = admin,
) => app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

let seq = 0;
async function produto(extra: object = {}) {
  const res = await req("POST", "/produtos", {
    sku: `P-${++seq}`,
    nome: `Produto ${seq}`,
    ...extra,
  });
  return res.json() as { id: number };
}
const mover = (corpo: object) => req("POST", "/movimentacoes", corpo);
const utc = (data: Date) => data.toISOString().slice(0, 10);
const hojeUtc = () => utc(new Date());
const diasAtras = (n: number) => utc(new Date(Date.now() - n * 86_400_000));
async function datar(produtoId: number, data: string, hora = "12:00:00") {
  await db
    .update(movimentacoes)
    .set({ criadoEm: `${data} ${hora}` })
    .where(eq(movimentacoes.produtoId, produtoId));
}

describe("autenticação", () => {
  it("exige login em todas as rotas do painel", async () => {
    for (const url of [
      "/estoque/resumo",
      "/estoque/fluxo",
      "/movimentacoes/contagem",
      "/categorias/estatisticas",
      "/fornecedores/estatisticas",
    ]) {
      expect((await req("GET", url, undefined, null)).statusCode).toBe(401);
    }
  });
});

describe("resumo do estoque", () => {
  it("conta produtos, inativos, categorias e movimentações do mês", async () => {
    const antes = (await req("GET", "/estoque/resumo")).json();
    expect(Object.keys(antes).sort()).toEqual(
      [
        "abaixoDoMinimo",
        "categorias",
        "movimentacoesMesAnterior",
        "movimentacoesNoMes",
        "produtosAtivos",
        "produtosInativos",
        "produtosNovosNoMes",
        "semEstoque",
        "valorEmEstoque",
      ].sort(),
    );

    await req("POST", "/categorias", { nome: "Eletrônicos" });
    const p = await produto();
    await produto({ ativo: false });
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 5 });
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 5 });

    const depois = (await req("GET", "/estoque/resumo")).json();
    expect(depois.produtosAtivos).toBe(antes.produtosAtivos + 1);
    expect(depois.produtosInativos).toBe(antes.produtosInativos + 1);
    expect(depois.produtosNovosNoMes).toBe(antes.produtosNovosNoMes + 1);
    expect(depois.categorias).toBe(antes.categorias + 1);
    expect(depois.movimentacoesNoMes).toBe(antes.movimentacoesNoMes + 2);
  });

  it("separa as movimentações do mês anterior", async () => {
    const p = await produto();
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 5 });
    await db
      .update(movimentacoes)
      .set({ criadoEm: sql`datetime('now', 'start of month', '-5 days')` });
    const r = (await req("GET", "/estoque/resumo")).json();
    expect(r).toMatchObject({ movimentacoesNoMes: 0, movimentacoesMesAnterior: 1 });
  });
});

describe("fluxo diário", () => {
  it("devolve um item por dia, com zeros onde não houve movimento", async () => {
    const p = await produto();
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 10 });
    await mover({ tipo: "saida", produtoId: p.id, quantidade: 4 });
    await mover({ tipo: "ajuste", produtoId: p.id, novoSaldo: 20, motivo: "contagem" });

    const { dias } = (await req("GET", "/estoque/fluxo?dias=7&fuso=0")).json();
    expect(dias).toHaveLength(7);
    expect(dias.map((d: { data: string }) => d.data)).toEqual(
      Array.from({ length: 7 }, (_, i) => diasAtras(6 - i)),
    );
    expect(dias.at(-1)).toEqual({ data: hojeUtc(), entradas: 10, saidas: 4 }); // ajuste fica de fora
    expect(
      dias
        .slice(0, 6)
        .every((d: { entradas: number; saidas: number }) => d.entradas === 0 && d.saidas === 0),
    ).toBe(true);
  });

  it("soma por dia e respeita o fuso horário informado", async () => {
    const p = await produto();
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 8 });
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 2 });
    await datar(p.id, hojeUtc(), "01:00:00"); // 01:00 UTC = 22:00 de ontem em UTC-3

    const utcDias = (await req("GET", "/estoque/fluxo?dias=3&fuso=0")).json().dias;
    expect(utcDias.at(-1)).toMatchObject({ data: hojeUtc(), entradas: 10 });

    const brt = (await req("GET", "/estoque/fluxo?dias=3&fuso=-180")).json().dias;
    const porData = Object.fromEntries(
      brt.map((d: { data: string; entradas: number }) => [d.data, d.entradas]),
    );
    expect(porData[diasAtras(1)]).toBe(10);
  });

  it("ignora o que ficou fora da janela", async () => {
    const p = await produto();
    await mover({ tipo: "saida", produtoId: p.id, quantidade: 1 }).catch(() => undefined);
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 9 });
    await datar(p.id, diasAtras(10));
    const { dias } = (await req("GET", "/estoque/fluxo?dias=7&fuso=0")).json();
    expect(dias.every((d: { entradas: number }) => d.entradas === 0)).toBe(true);
  });

  it("valida os parâmetros", async () => {
    expect((await req("GET", "/estoque/fluxo?dias=0")).statusCode).toBe(400);
    expect((await req("GET", "/estoque/fluxo?dias=61")).statusCode).toBe(400);
    expect((await req("GET", "/estoque/fluxo?fuso=9999")).statusCode).toBe(400);
    expect((await req("GET", "/estoque/fluxo?fuso=abc")).statusCode).toBe(400);
    expect((await req("GET", "/estoque/fluxo")).json().dias).toHaveLength(7);
  });
});

describe("contagem de movimentações", () => {
  it("conta por tipo e respeita produto e período", async () => {
    const a = await produto();
    const b = await produto();
    await mover({ tipo: "entrada", produtoId: a.id, quantidade: 10 });
    await mover({ tipo: "saida", produtoId: a.id, quantidade: 2 });
    await mover({ tipo: "ajuste", produtoId: a.id, novoSaldo: 5, motivo: "contagem" });
    await mover({ tipo: "entrada", produtoId: b.id, quantidade: 3 });

    expect((await req("GET", "/movimentacoes/contagem")).json()).toEqual({
      todas: 4,
      entrada: 2,
      saida: 1,
      ajuste: 1,
    });
    expect((await req("GET", `/movimentacoes/contagem?produtoId=${a.id}`)).json()).toEqual({
      todas: 3,
      entrada: 1,
      saida: 1,
      ajuste: 1,
    });

    await datar(b.id, "2020-01-15");
    expect((await req("GET", "/movimentacoes/contagem?ate=2020-12-31")).json()).toEqual({
      todas: 1,
      entrada: 1,
      saida: 0,
      ajuste: 0,
    });
    expect((await req("GET", `/movimentacoes/contagem?de=${hojeUtc()}`)).json().todas).toBe(3);
    expect((await req("GET", "/movimentacoes/contagem?de=ontem")).statusCode).toBe(400);
  });

  it("devolve zeros quando não há movimentações", async () => {
    expect((await req("GET", "/movimentacoes/contagem")).json()).toEqual({
      todas: 0,
      entrada: 0,
      saida: 0,
      ajuste: 0,
    });
  });
});

describe("filtro de produtos por situação do estoque", () => {
  it("separa saudável, baixo e sem estoque", async () => {
    const saudavel = await produto({ estoqueMinimo: 5 });
    const igualMinimo = await produto({ estoqueMinimo: 5 });
    const zerado = await produto({ estoqueMinimo: 5 });
    const semMinimo = await produto();
    const semMinimoZerado = await produto();
    await mover({ tipo: "entrada", produtoId: saudavel.id, quantidade: 10 });
    await mover({ tipo: "entrada", produtoId: igualMinimo.id, quantidade: 5 });
    await mover({ tipo: "entrada", produtoId: semMinimo.id, quantidade: 1 });
    void zerado;
    void semMinimoZerado;

    const ids = async (situacao: string) =>
      (await req("GET", `/produtos?situacao=${situacao}&pageSize=100`))
        .json()
        .items.map((p: { id: number }) => p.id)
        .sort();

    expect(await ids("saudavel")).toEqual([saudavel.id, semMinimo.id].sort());
    expect(await ids("baixo")).toEqual([igualMinimo.id, zerado.id].sort());
    expect(await ids("sem")).toEqual([zerado.id, semMinimoZerado.id].sort());
    expect((await req("GET", "/produtos?situacao=outra")).statusCode).toBe(400);
  });

  it("o parâmetro antigo abaixoDoMinimo continua funcionando", async () => {
    const p = await produto({ estoqueMinimo: 5 });
    const ids = (await req("GET", "/produtos?abaixoDoMinimo=true"))
      .json()
      .items.map((x: { id: number }) => x.id);
    expect(ids).toContain(p.id);
  });
});

describe("estatísticas por categoria", () => {
  it("soma produtos, saldo, valor e alertas, ignorando produtos inativos", async () => {
    const eletronicos = (await req("POST", "/categorias", { nome: "Eletrônicos" })).json();
    const vazia = (await req("POST", "/categorias", { nome: "Vazia" })).json();
    const a = await produto({ categoriaId: eletronicos.id, precoCusto: 1000, estoqueMinimo: 10 });
    const b = await produto({ categoriaId: eletronicos.id, precoCusto: 500, estoqueMinimo: 1 });
    const inativo = await produto({ categoriaId: eletronicos.id, precoCusto: 99999, ativo: false });
    await produto();
    await mover({ tipo: "entrada", produtoId: a.id, quantidade: 4 }); // 4 <= 10: em alerta
    await mover({ tipo: "entrada", produtoId: b.id, quantidade: 10 });
    void inativo;

    const { items, semCategoria } = (await req("GET", "/categorias/estatisticas")).json();
    expect(items.find((c: { id: number }) => c.id === eletronicos.id)).toEqual({
      id: eletronicos.id,
      nome: "Eletrônicos",
      totalProdutos: 2,
      saldoTotal: 14,
      valorEmEstoque: 4 * 1000 + 10 * 500,
      emAlerta: 1,
    });
    expect(items.find((c: { id: number }) => c.id === vazia.id)).toMatchObject({
      totalProdutos: 0,
      saldoTotal: 0,
      valorEmEstoque: 0,
      emAlerta: 0,
    });
    expect(semCategoria).toBe(1);
    expect(items.map((c: { nome: string }) => c.nome)).toEqual(["Eletrônicos", "Vazia"]);
  });
});

describe("estatísticas por fornecedor", () => {
  it("conta entradas, produtos distintos, unidades e a última entrada", async () => {
    const acme = (await req("POST", "/fornecedores", { nome: "Acme" })).json();
    const sem = (await req("POST", "/fornecedores", { nome: "Sem entradas" })).json();
    const a = await produto();
    const b = await produto();
    await mover({ tipo: "entrada", produtoId: a.id, quantidade: 10, fornecedorId: acme.id });
    await mover({ tipo: "entrada", produtoId: a.id, quantidade: 5, fornecedorId: acme.id });
    await mover({ tipo: "entrada", produtoId: b.id, quantidade: 7, fornecedorId: acme.id });
    await mover({ tipo: "entrada", produtoId: b.id, quantidade: 1 }); // sem fornecedor
    await mover({ tipo: "saida", produtoId: a.id, quantidade: 2 });

    const { items, entradasNoMes } = (await req("GET", "/fornecedores/estatisticas")).json();
    const porId = Object.fromEntries(items.map((f: { id: number }) => [f.id, f]));
    expect(porId[acme.id]).toMatchObject({ entradas: 3, produtos: 2, unidades: 22 });
    expect(porId[acme.id].ultimaEntrada).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect(porId[sem.id]).toMatchObject({
      entradas: 0,
      produtos: 0,
      unidades: 0,
      ultimaEntrada: null,
    });
    expect(entradasNoMes).toBe(3);
  });

  it("não conta entradas de meses anteriores em entradasNoMes", async () => {
    const f = (await req("POST", "/fornecedores", { nome: "Acme" })).json();
    const p = await produto();
    await mover({ tipo: "entrada", produtoId: p.id, quantidade: 5, fornecedorId: f.id });
    await datar(p.id, "2020-03-01");
    const { items, entradasNoMes } = (await req("GET", "/fornecedores/estatisticas")).json();
    expect(entradasNoMes).toBe(0);
    expect(items[0]).toMatchObject({ entradas: 1, ultimaEntrada: "2020-03-01 12:00:00" });
  });
});
