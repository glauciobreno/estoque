import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { sql } from "drizzle-orm";
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

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Mensagens em português para erros que o próprio Fastify gera (corpo inválido, grande demais...). */
const ERROS_FASTIFY: Record<string, [number, string]> = {
  FST_ERR_CTP_BODY_TOO_LARGE: [413, "Corpo da requisição grande demais"],
  FST_ERR_CTP_INVALID_MEDIA_TYPE: [415, "Tipo de conteúdo não suportado; use application/json"],
  FST_ERR_CTP_INVALID_JSON_BODY: [400, "Corpo da requisição não é um JSON válido"],
  FST_ERR_CTP_EMPTY_JSON_BODY: [400, "Corpo da requisição vazio"],
};

export async function buildApp({ db, config }: { db: Db; config: Config }) {
  const app = Fastify({
    logger:
      config.logLevel === "silent"
        ? false
        : {
            level: config.logLevel,
            redact: [
              "req.headers.cookie",
              "req.headers.authorization",
              'res.headers["set-cookie"]',
            ],
          },
    genReqId: () => randomUUID(),
    trustProxy: config.trustProxy,
    bodyLimit: 100 * 1024,
  });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-request-id", req.id);

    // Defesa extra contra CSRF: um navegador sempre informa a Origin em requisições que alteram
    // dados, e só a origem do nosso front pode fazê-lo. Clientes sem Origin (curl, testes) passam.
    const origem = req.headers.origin;
    if (!METODOS_SEGUROS.has(req.method) && origem && !config.corsOrigins.includes(origem)) {
      return reply.code(403).send({ erro: "Origem não permitida" });
    }
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ erro: "Rota não encontrada" }));

  app.setErrorHandler((erro, req, reply) => {
    if (erro instanceof ZodError) {
      return reply.code(400).send({ erro: "Dados inválidos", detalhes: erro.issues });
    }
    if (erro instanceof HttpError) {
      return reply.code(erro.statusCode).send({ erro: erro.message });
    }

    const { statusCode, code, message } = erro as {
      statusCode?: number;
      code?: string;
      message: string;
    };
    const conhecido = code ? ERROS_FASTIFY[code] : undefined;
    if (conhecido) return reply.code(conhecido[0]).send({ erro: conhecido[1] });
    if (statusCode === 429) return reply.code(429).send({ erro: message });
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ erro: "Requisição inválida" });
    }

    req.log.error({ err: erro }, "erro não tratado");
    return reply.code(500).send({ erro: "Erro interno", requestId: req.id });
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.corsOrigins, credentials: true });
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, contexto) =>
      Object.assign(new Error(`Muitas requisições. Tente novamente em ${contexto.after}.`), {
        statusCode: 429,
      }),
  });
  await app.register(authPlugin, { config });

  // /health: o processo está de pé. /health/ready: também alcança o banco (usado após o deploy).
  app.get("/health", { config: { rateLimit: false } }, async () => ({ status: "ok" }));
  app.get("/health/ready", { config: { rateLimit: false } }, async (req, reply) => {
    try {
      await db.run(sql`select 1`);
      return { status: "ok", banco: "ok" };
    } catch (erro) {
      req.log.error({ err: erro }, "banco indisponível");
      return reply.code(503).send({ status: "indisponivel", banco: "falha", requestId: req.id });
    }
  });

  await app.register(rotasAuth, { db, config });
  await app.register(rotasCategorias, { db });
  await app.register(rotasFornecedores, { db });
  await app.register(rotasProdutos, { db });
  await app.register(rotasMovimentacoes, { db });

  return app;
}
