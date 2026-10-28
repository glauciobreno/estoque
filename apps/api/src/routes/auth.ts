import { loginSchema } from "@estoque/shared";
import { compare, hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { usuarios } from "../db/schema.js";
import { HttpError } from "../erros.js";
import { COOKIE } from "../plugins/auth.js";

// Hash de uma senha qualquer: mantém o tempo de resposta igual quando o e-mail não existe.
const HASH_FALSO = hashSync("senha-inexistente", 10);

export const rotasAuth: FastifyPluginAsync<{ db: Db; config: Config }> = async (
  app,
  { db, config },
) => {
  const opcoesCookie = {
    httpOnly: true,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    path: "/",
  } as const;

  // Limite próprio e mais restrito contra tentativa de adivinhar senhas.
  const limiteLogin = { rateLimit: { max: config.rateLimit.loginMax, timeWindow: "1 minute" } };

  app.post("/auth/login", { config: limiteLogin }, async (req, reply) => {
    const { email, senha } = loginSchema.parse(req.body);
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email));
    const ok = await compare(senha, usuario?.senhaHash ?? HASH_FALSO);
    if (!usuario || !ok) throw new HttpError(401, "E-mail ou senha inválidos");

    const token = app.jwt.sign({ id: usuario.id, papel: usuario.papel });
    reply.setCookie(COOKIE, token, { ...opcoesCookie, maxAge: 7 * 24 * 60 * 60 });
    return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel };
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE, opcoesCookie);
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: app.autenticar }, async (req) => {
    const [usuario] = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        papel: usuarios.papel,
      })
      .from(usuarios)
      .where(eq(usuarios.id, req.user.id));
    if (!usuario) throw new HttpError(401, "Não autenticado");
    return usuario;
  });
};
