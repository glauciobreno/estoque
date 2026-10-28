import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import type { Papel } from "@estoque/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Config } from "../config.js";
import { HttpError } from "../erros.js";

export const COOKIE = "token";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: number; papel: Papel };
    user: { id: number; papel: Papel };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    autenticar: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    exigirPapel: (papel: Papel) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp<{ config: Config }>(async (app, { config }) => {
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
  });

  app.decorate("exigirPapel", (papel: Papel) => async (req: FastifyRequest) => {
    await app.autenticar(req, undefined as never);
    if (req.user.papel !== papel && req.user.papel !== "admin") {
      throw new HttpError(403, "Sem permissão");
    }
  });
});
