import { categoriaSchema, idSchema, listagemSchema } from "@estoque/shared";
import { count, eq, like } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db/client.js";
import { categorias, produtos } from "../db/schema.js";
import { HttpError, naoEncontrado, tratarUnico } from "../erros.js";
import { deslocamento, pagina } from "../paginacao.js";

export const rotasCategorias: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const admin = app.exigirPapel("admin");

  app.get("/categorias", { preHandler: app.autenticar }, async (req) => {
    const { q, page, pageSize } = listagemSchema.parse(req.query);
    const filtro = q ? like(categorias.nome, `%${q}%`) : undefined;
    const items = await db
      .select()
      .from(categorias)
      .where(filtro)
      .orderBy(categorias.nome)
      .limit(pageSize)
      .offset(deslocamento(page, pageSize));
    const [{ total } = { total: 0 }] = await db
      .select({ total: count() })
      .from(categorias)
      .where(filtro);
    return pagina(items, total, page, pageSize);
  });

  app.get("/categorias/:id", { preHandler: app.autenticar }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const [categoria] = await db.select().from(categorias).where(eq(categorias.id, id));
    if (!categoria) throw naoEncontrado("Categoria");
    return categoria;
  });

  app.post("/categorias", { preHandler: admin }, async (req, reply) => {
    const dados = categoriaSchema.parse(req.body);
    const [criada] = await db
      .insert(categorias)
      .values(dados)
      .returning()
      .catch((e) => tratarUnico(e, "Já existe uma categoria com esse nome"));
    return reply.code(201).send(criada);
  });

  app.put("/categorias/:id", { preHandler: admin }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const dados = categoriaSchema.parse(req.body);
    const [atualizada] = await db
      .update(categorias)
      .set(dados)
      .where(eq(categorias.id, id))
      .returning()
      .catch((e) => tratarUnico(e, "Já existe uma categoria com esse nome"));
    if (!atualizada) throw naoEncontrado("Categoria");
    return atualizada;
  });

  app.delete("/categorias/:id", { preHandler: admin }, async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const [{ usos } = { usos: 0 }] = await db
      .select({ usos: count() })
      .from(produtos)
      .where(eq(produtos.categoriaId, id));
    if (usos > 0) throw new HttpError(409, "Categoria possui produtos vinculados");
    const removidas = await db.delete(categorias).where(eq(categorias.id, id)).returning();
    if (removidas.length === 0) throw naoEncontrado("Categoria");
    return reply.code(204).send();
  });
};
