/**
 * Ponto de entrada serverless (Vercel): exporta um handler (req, res).
 * Localmente e em hosts com processo contínuo, o ponto de entrada é server.ts.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./aplicacao.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";

let instancia: ReturnType<typeof iniciar> | undefined;

async function iniciar() {
  const config = loadConfig();
  const app = await buildApp({
    db: createDb(config.databaseUrl, config.databaseAuthToken),
    config,
  });
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Uma instância por contêiner quente. Se a inicialização falhar (ex.: variável ausente),
  // a próxima requisição tenta de novo em vez de ficar presa ao erro.
  instancia ??= iniciar().catch((erro: unknown) => {
    instancia = undefined;
    console.error("Falha ao iniciar a API:", erro);
    throw erro;
  });
  const app = await instancia;
  app.server.emit("request", req, res);
}
