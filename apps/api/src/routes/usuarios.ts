import { idSchema, usuarioAtualizarSchema, usuarioCriarSchema } from "@estoque/shared";
import { eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { novoConvite } from "../convite.js";
import type { Db } from "../db/client.js";
import { SEM_SENHA, usuarios } from "../db/schema.js";
import { HttpError, naoEncontrado, tratarUnico } from "../erros.js";

type UsuarioDb = typeof usuarios.$inferSelect;

/** Nunca expõe hash de senha nem de convite. */
const apresentar = (u: UsuarioDb) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  papel: u.papel,
  ativo: u.ativo,
  pendente: u.senhaHash === SEM_SENHA,
  conviteExpiraEm: u.conviteExpiraEm,
  criadoEm: u.criadoEm,
});

export const rotasUsuarios: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const admin = app.exigirPapel("admin");

  async function gravarConvite(id: number) {
    const convite = novoConvite();
    const [usuario] = await db
      .update(usuarios)
      .set({ conviteHash: convite.hash, conviteExpiraEm: convite.expiraEm })
      .where(eq(usuarios.id, id))
      .returning();
    return { usuario: usuario!, convite: { token: convite.token, expiraEm: convite.expiraEm } };
  }

  app.get("/usuarios", { preHandler: admin }, async () => {
    const lista = await db.select().from(usuarios).orderBy(usuarios.nome);
    return { items: lista.map(apresentar) };
  });

  // O administrador informa só nome, e-mail e papel. O usuário define a própria senha ao abrir o
  // link de primeiro acesso, que é mostrado uma única vez (o banco guarda apenas o hash).
  app.post("/usuarios", { preHandler: admin }, async (req, reply) => {
    const dados = usuarioCriarSchema.parse(req.body);
    const convite = novoConvite();
    const [criado] = await db
      .insert(usuarios)
      .values({
        ...dados,
        senhaHash: SEM_SENHA,
        conviteHash: convite.hash,
        conviteExpiraEm: convite.expiraEm,
      })
      .returning()
      .catch((e) => tratarUnico(e, "Já existe um usuário com esse e-mail"));
    return reply.code(201).send({
      usuario: apresentar(criado!),
      convite: { token: convite.token, expiraEm: convite.expiraEm },
    });
  });

  // Novo link de primeiro acesso, ou de redefinição de senha para quem já tem conta.
  // A senha atual continua valendo até o link ser usado.
  app.post("/usuarios/:id/convite", { preHandler: admin }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const [existente] = await db.select().from(usuarios).where(eq(usuarios.id, id));
    if (!existente) throw naoEncontrado("Usuário");
    if (!existente.ativo)
      throw new HttpError(409, "Usuário inativo; reative-o antes de gerar um link");
    const { usuario, convite } = await gravarConvite(id);
    return { usuario: apresentar(usuario), convite };
  });

  app.patch("/usuarios/:id", { preHandler: admin }, async (req) => {
    const { id } = idSchema.parse(req.params);
    const dados = usuarioAtualizarSchema.parse(req.body);

    const [atual] = await db.select().from(usuarios).where(eq(usuarios.id, id));
    if (!atual) throw naoEncontrado("Usuário");
    // Evita o administrador se trancar para fora (e garante que sempre sobra um admin ativo).
    if (id === req.user.id) {
      if (dados.ativo === false || (dados.papel !== undefined && dados.papel !== atual.papel)) {
        throw new HttpError(409, "Você não pode alterar o próprio papel nem se desativar");
      }
    }

    const [atualizado] = await db
      .update(usuarios)
      .set({
        ...dados,
        // Desativar encerra as sessões abertas e invalida qualquer link pendente. Reativar não
        // as ressuscita: a pessoa entra de novo com a senha.
        ...(dados.ativo === false
          ? {
              conviteHash: null,
              conviteExpiraEm: null,
              sessaoVersao: sql`${usuarios.sessaoVersao} + 1`,
            }
          : {}),
      })
      .where(eq(usuarios.id, id))
      .returning();
    return apresentar(atualizado!);
  });
};
