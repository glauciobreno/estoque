import { fornecedorSchema, idSchema, listagemSchema } from "@estoque/shared";
import { count, eq, like, or } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db/client.js";
import { fornecedores, movimentacoes } from "../db/schema.js";
import { HttpError, naoEncontrado } from "../erros.js";
import { deslocamento, pagina } from "../paginacao.js";

export const rotasFornecedores: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const admin = app.exigirPapel("admin");

  app.get("/fornecedores", { preHandler: app.autenticar }, async (req) => {
    const { q, page, pageSize } = listagemSchema.parse(req.query);
    const filtro = q
      ? or(like(fornecedores.nome, `%${q}%`), like(fornecedores.contato, `%${q}%`))
      : undefined;
    const items = await db
      .select()
      .from(fornecedores)
      .where(filtro)
      .orderBy(fornecedores.nome)
      .limit(pageSize)
      .offset(deslocamento(page, pageSize));
    const [{ total } = { total: 0 }] = await db
      .select({ total: count() })
      .from(fornecedores)
      .where(filtro);
    return pagina(items, total, page, pageSize);
  });

  app.get("/fornecedores/:id", { preHandler: app.autenticar }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const [fornecedor] = await db.select().from(fornecedores).where(eq(fornecedores.id, id));
    if (!fornecedor) throw naoEncontrado("Fornecedor");
    return fornecedor;
  });

  app.post("/fornecedores", { preHandler: admin }, async (req, reply) => {
    const dados = fornecedorSchema.parse(req.body);
    const [criado] = await db.insert(fornecedores).values(dados).returning();
    return reply.code(201).send(criado);
  });

  app.put("/fornecedores/:id", { preHandler: admin }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const dados = fornecedorSchema.parse(req.body);
    const [atualizado] = await db
      .update(fornecedores)
      .set(dados)
      .where(eq(fornecedores.id, id))
      .returning();
    if (!atualizado) throw naoEncontrado("Fornecedor");
    return atualizado;
  });

  app.delete("/fornecedores/:id", { preHandler: admin }, async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const [{ usos } = { usos: 0 }] = await db
      .select({ usos: count() })
      .from(movimentacoes)
      .where(eq(movimentacoes.fornecedorId, id));
    if (usos > 0) throw new HttpError(409, "Fornecedor possui movimentações vinculadas");
    const removidos = await db.delete(fornecedores).where(eq(fornecedores.id, id)).returning();
    if (removidos.length === 0) throw naoEncontrado("Fornecedor");
    return reply.code(204).send();
  });
};
