import {
  alterarSenhaSchema,
  conviteAceitarSchema,
  conviteVerificarSchema,
  loginSchema,
} from "@estoque/shared";
import { compare, hash, hashSync } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { SEM_SENHA, usuarios } from "../db/schema.js";
import { hashConvite } from "../convite.js";
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

  type UsuarioDb = typeof usuarios.$inferSelect;
  const publico = (u: UsuarioDb) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel });
  const entrar = (reply: FastifyReply, u: UsuarioDb) => {
    const token = app.jwt.sign({ id: u.id, papel: u.papel, v: u.sessaoVersao });
    reply.setCookie(COOKIE, token, { ...opcoesCookie, maxAge: 7 * 24 * 60 * 60 });
  };

  // Limite próprio e mais restrito contra tentativa de adivinhar senhas.
  const limiteLogin = { rateLimit: { max: config.rateLimit.loginMax, timeWindow: "1 minute" } };

  app.post("/auth/login", { config: limiteLogin }, async (req, reply) => {
    const { email, senha } = loginSchema.parse(req.body);
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email));
    // Conta inexistente, inativa ou sem senha definida: mesma resposta e mesmo tempo de uma senha errada.
    const utilizavel = usuario?.ativo && usuario.senhaHash !== SEM_SENHA;
    const ok = await compare(senha, utilizavel ? usuario.senhaHash : HASH_FALSO);
    if (!usuario || !utilizavel || !ok) throw new HttpError(401, "E-mail ou senha inválidos");

    entrar(reply, usuario);
    return publico(usuario);
  });

  const MENSAGEM_CONVITE = "Convite inválido ou expirado";

  async function usuarioDoConvite(token: string) {
    const [usuario] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.conviteHash, hashConvite(token)));
    const expirado = !usuario?.conviteExpiraEm || new Date(usuario.conviteExpiraEm) <= new Date();
    if (!usuario || !usuario.ativo || expirado) throw new HttpError(400, MENSAGEM_CONVITE);
    return usuario;
  }

  // O token vai no corpo (e não na URL) para não aparecer em logs de acesso.
  app.post("/auth/convite/verificar", { config: limiteLogin }, async (req) => {
    const { token } = conviteVerificarSchema.parse(req.body);
    const usuario = await usuarioDoConvite(token);
    return {
      nome: usuario.nome,
      email: usuario.email,
      redefinicao: usuario.senhaHash !== SEM_SENHA,
    };
  });

  app.post("/auth/convite/aceitar", { config: limiteLogin }, async (req, reply) => {
    const { token, senha } = conviteAceitarSchema.parse(req.body);
    const usuario = await usuarioDoConvite(token);
    // O WHERE pelo hash garante uso único mesmo com dois envios simultâneos do mesmo link.
    // Definir a senha encerra as sessões antigas da conta (redefinição); a nova já nasce logada.
    const [gravado] = await db
      .update(usuarios)
      .set({
        senhaHash: await hash(senha, 10),
        conviteHash: null,
        conviteExpiraEm: null,
        sessaoVersao: sql`${usuarios.sessaoVersao} + 1`,
      })
      .where(and(eq(usuarios.id, usuario.id), eq(usuarios.conviteHash, hashConvite(token))))
      .returning();
    if (!gravado) throw new HttpError(400, MENSAGEM_CONVITE);

    entrar(reply, gravado);
    return publico(gravado);
  });

  app.post(
    "/auth/senha",
    { config: limiteLogin, preHandler: app.autenticar },
    async (req, reply) => {
      const { senhaAtual, novaSenha } = alterarSenhaSchema.parse(req.body);
      const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, req.user.id));
      if (!usuario || !(await compare(senhaAtual, usuario.senhaHash))) {
        throw new HttpError(400, "Senha atual incorreta");
      }
      if (senhaAtual === novaSenha)
        throw new HttpError(400, "A nova senha deve ser diferente da atual");
      // Trocar a senha encerra as outras sessões; esta recebe um cookie novo para continuar logada.
      const [atualizado] = await db
        .update(usuarios)
        .set({
          senhaHash: await hash(novaSenha, 10),
          sessaoVersao: sql`${usuarios.sessaoVersao} + 1`,
        })
        .where(eq(usuarios.id, usuario.id))
        .returning();
      entrar(reply, atualizado!);
      return reply.code(204).send();
    },
  );

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
