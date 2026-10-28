import {
  idSchema,
  listagemSchema,
  movimentacaoListagemSchema,
  movimentacaoSchema,
} from "@estoque/shared";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db/client.js";
import { movimentacoes, produtos, usuarios } from "../db/schema.js";
import { naoEncontrado } from "../erros.js";
import { abaixoDoMinimo, registrarMovimentacao } from "../estoque.js";
import { deslocamento, pagina } from "../paginacao.js";

type Filtros = ReturnType<typeof movimentacaoListagemSchema.parse>;

export const rotasMovimentacoes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  async function listar({ produtoId, tipo, de, ate, page, pageSize }: Filtros) {
    const filtro = and(
      produtoId ? eq(movimentacoes.produtoId, produtoId) : undefined,
      tipo ? eq(movimentacoes.tipo, tipo) : undefined,
      de ? gte(movimentacoes.criadoEm, `${de} 00:00:00`) : undefined,
      ate ? lte(movimentacoes.criadoEm, `${ate} 23:59:59`) : undefined,
    );
    const items = await db
      .select({
        id: movimentacoes.id,
        produtoId: movimentacoes.produtoId,
        produtoSku: produtos.sku,
        produtoNome: produtos.nome,
        tipo: movimentacoes.tipo,
        quantidade: movimentacoes.quantidade,
        motivo: movimentacoes.motivo,
        fornecedorId: movimentacoes.fornecedorId,
        usuarioId: movimentacoes.usuarioId,
        usuarioNome: usuarios.nome,
        criadoEm: movimentacoes.criadoEm,
      })
      .from(movimentacoes)
      .innerJoin(produtos, eq(produtos.id, movimentacoes.produtoId))
      .innerJoin(usuarios, eq(usuarios.id, movimentacoes.usuarioId))
      .where(filtro)
      .orderBy(desc(movimentacoes.criadoEm), desc(movimentacoes.id))
      .limit(pageSize)
      .offset(deslocamento(page, pageSize));
    const [{ total } = { total: 0 }] = await db
      .select({ total: count() })
      .from(movimentacoes)
      .where(filtro);
    return pagina(items, total, page, pageSize);
  }

  // Movimentações são imutáveis: não há PUT nem DELETE. Correções são novos ajustes.
  app.post("/movimentacoes", { preHandler: app.autenticar }, async (req, reply) => {
    const dados = movimentacaoSchema.parse(req.body);
    return reply.code(201).send(await registrarMovimentacao(db, dados, req.user.id));
  });

  app.get("/movimentacoes", { preHandler: app.autenticar }, async (req) =>
    listar(movimentacaoListagemSchema.parse(req.query)),
  );

  app.get("/produtos/:id/movimentacoes", { preHandler: app.autenticar }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const [produto] = await db
      .select({ id: produtos.id })
      .from(produtos)
      .where(eq(produtos.id, id));
    if (!produto) throw naoEncontrado("Produto");
    return listar(movimentacaoListagemSchema.parse({ ...(req.query as object), produtoId: id }));
  });

  app.get("/estoque/alertas", { preHandler: app.autenticar }, async (req) => {
    const { page, pageSize } = listagemSchema.omit({ q: true }).parse(req.query);
    const filtro = and(eq(produtos.ativo, true), abaixoDoMinimo);
    const items = await db
      .select()
      .from(produtos)
      .where(filtro)
      .orderBy(produtos.saldoAtual, produtos.nome)
      .limit(pageSize)
      .offset(deslocamento(page, pageSize));
    const [{ total } = { total: 0 }] = await db
      .select({ total: count() })
      .from(produtos)
      .where(filtro);
    return pagina(items, total, page, pageSize);
  });

  app.get("/estoque/resumo", { preHandler: app.autenticar }, async () => {
    const [resumo] = await db
      .select({
        produtosAtivos: count(),
        valorEmEstoque: sql<number>`coalesce(sum(${produtos.saldoAtual} * ${produtos.precoCusto}), 0)`,
        abaixoDoMinimo: sql<number>`coalesce(sum(case when ${abaixoDoMinimo} then 1 else 0 end), 0)`,
        semEstoque: sql<number>`coalesce(sum(case when ${produtos.saldoAtual} = 0 then 1 else 0 end), 0)`,
      })
      .from(produtos)
      .where(eq(produtos.ativo, true));
    return resumo ?? { produtosAtivos: 0, valorEmEstoque: 0, abaixoDoMinimo: 0, semEstoque: 0 };
  });
};
