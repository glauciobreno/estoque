import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import type { Papel } from "@estoque/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import fp from "fastify-plugin";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { usuarios } from "../db/schema.js";
import { HttpError } from "../erros.js";

export const COOKIE = "token";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    // v: versão da sessão; tokens emitidos antes deste campo existir não o trazem (equivale a 0).
    payload: { id: number; papel: Papel; v?: number };
    user: { id: number; papel: Papel; v?: number };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    autenticar: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    exigirPapel: (papel: Papel) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp<{ config: Config; db: Db }>(async (app, { config, db }) => {
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: COOKIE, signed: false },
    sign: { expiresIn: "7d" },
  });

  app.decorate("autenticar", async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new HttpError(401, "Não autenticado");
    }
    // O token só identifica a pessoa e a sessão. Situação, papel e versão da sessão vêm do banco a
    // cada requisição: desativar, mudar o papel ou trocar a senha vale na hora, sem esperar o token expirar.
    const [usuario] = await db
      .select({ papel: usuarios.papel, ativo: usuarios.ativo, sessaoVersao: usuarios.sessaoVersao })
      .from(usuarios)
      .where(eq(usuarios.id, req.user.id));
    if (!usuario?.ativo || (req.user.v ?? 0) !== usuario.sessaoVersao) {
      throw new HttpError(401, "Não autenticado");
    }
    req.user = { id: req.user.id, papel: usuario.papel, v: usuario.sessaoVersao };
  });

  app.decorate("exigirPapel", (papel: Papel) => async (req: FastifyRequest) => {
    await app.autenticar(req, undefined as never);
    if (req.user.papel !== papel && req.user.papel !== "admin") {
      throw new HttpError(403, "Sem permissão");
    }
  });
});
