import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";
import { HttpError } from "./erros.js";
import authPlugin from "./plugins/auth.js";
import { rotasAuth } from "./routes/auth.js";
import { rotasCategorias } from "./routes/categorias.js";
import { rotasFornecedores } from "./routes/fornecedores.js";
import { rotasMovimentacoes } from "./routes/movimentacoes.js";
import { rotasProdutos } from "./routes/produtos.js";

export async function buildApp({ db, config }: { db: Db; config: Config }) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.setErrorHandler((erro, _req, reply) => {
    if (erro instanceof ZodError) {
      return reply.code(400).send({ erro: "Dados inválidos", detalhes: erro.issues });
    }
    if (erro instanceof HttpError) {
      return reply.code(erro.statusCode).send({ erro: erro.message });
    }
    const status = (erro as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(erro);
    return reply
      .code(status)
      .send({ erro: status >= 500 ? "Erro interno" : (erro as Error).message });
  });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(authPlugin, { config });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(rotasAuth, { db, config });
  await app.register(rotasCategorias, { db });
  await app.register(rotasFornecedores, { db });
  await app.register(rotasProdutos, { db });
  await app.register(rotasMovimentacoes, { db });

  return app;
}
