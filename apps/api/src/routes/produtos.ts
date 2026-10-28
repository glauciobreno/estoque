import { idSchema, produtoListagemSchema, produtoSchema } from "@estoque/shared";
import { and, count, eq, like, or } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db/client.js";
import { categorias, movimentacoes, produtos } from "../db/schema.js";
import { abaixoDoMinimo } from "../estoque.js";
import { HttpError, naoEncontrado, tratarUnico } from "../erros.js";
import { deslocamento, pagina } from "../paginacao.js";

export const rotasProdutos: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const admin = app.exigirPapel("admin");

  async function validarCategoria(categoriaId: number | null | undefined) {
    if (categoriaId == null) return;
    const [existe] = await db
      .select({ id: categorias.id })
      .from(categorias)
      .where(eq(categorias.id, categoriaId));
    if (!existe) throw new HttpError(400, "Categoria inexistente");
  }

  app.get("/produtos", { preHandler: app.autenticar }, async (req) => {
    const {
      q,
      page,
      pageSize,
      categoriaId,
      ativo,
      abaixoDoMinimo: filtrarAbaixo,
    } = produtoListagemSchema.parse(req.query);
    const filtro = and(
      q ? or(like(produtos.nome, `%${q}%`), like(produtos.sku, `%${q}%`)) : undefined,
      categoriaId ? eq(produtos.categoriaId, categoriaId) : undefined,
      ativo === undefined ? undefined : eq(produtos.ativo, ativo),
      filtrarAbaixo ? abaixoDoMinimo : undefined,
    );
    const items = await db
      .select()
      .from(produtos)
      .where(filtro)
      .orderBy(produtos.nome)
      .limit(pageSize)
      .offset(deslocamento(page, pageSize));
    const [{ total } = { total: 0 }] = await db
      .select({ total: count() })
      .from(produtos)
      .where(filtro);
    return pagina(items, total, page, pageSize);
  });

  app.get("/produtos/:id", { preHandler: app.autenticar }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const [produto] = await db.select().from(produtos).where(eq(produtos.id, id));
    if (!produto) throw naoEncontrado("Produto");
    return produto;
  });

  app.post("/produtos", { preHandler: admin }, async (req, reply) => {
    const dados = produtoSchema.parse(req.body);
    await validarCategoria(dados.categoriaId);
    const [criado] = await db
      .insert(produtos)
      .values(dados)
      .returning()
      .catch((e) => tratarUnico(e, "Já existe um produto com esse SKU"));
    return reply.code(201).send(criado);
  });

  app.put("/produtos/:id", { preHandler: admin }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const dados = produtoSchema.parse(req.body);
    await validarCategoria(dados.categoriaId);
    const [atualizado] = await db
      .update(produtos)
      .set({ ...dados, categoriaId: dados.categoriaId ?? null })
      .where(eq(produtos.id, id))
      .returning()
      .catch((e) => tratarUnico(e, "Já existe um produto com esse SKU"));
    if (!atualizado) throw naoEncontrado("Produto");
    return atualizado;
  });

  app.delete("/produtos/:id", { preHandler: admin }, async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const [{ usos } = { usos: 0 }] = await db
      .select({ usos: count() })
      .from(movimentacoes)
      .where(eq(movimentacoes.produtoId, id));
    if (usos > 0)
      throw new HttpError(409, "Produto possui movimentações; inative-o em vez de excluir");
    const removidos = await db.delete(produtos).where(eq(produtos.id, id)).returning();
    if (removidos.length === 0) throw naoEncontrado("Produto");
    return reply.code(204).send();
  });
};
