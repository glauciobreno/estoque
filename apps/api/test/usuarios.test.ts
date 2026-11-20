import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/db/client.js";
import { usuarios } from "../src/db/schema.js";
import { criarApp, login, type App } from "./helpers.js";

let app: App;
let db: ReturnType<typeof createDb>;
let admin: string;

beforeEach(async () => {
  db = createDb(":memory:");
  app = await criarApp({}, db);
  admin = (await login(app, "admin@x.com", "admin123")).cookie;
});
afterEach(() => app.close());

const chamar = (method: "GET" | "POST" | "PATCH", url: string, cookie?: string, payload?: object) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

async function criar(nome = "Carla Souza", email = "carla@x.com", papel = "operador") {
  const res = await chamar("POST", "/usuarios", admin, { nome, email, papel });
  return { res, corpo: res.json(), token: res.json().convite?.token as string };
}

const aceitar = (token: string, senha: string) =>
  chamar("POST", "/auth/convite/aceitar", undefined, { token, senha });

describe("permissões", () => {
  it("só o administrador administra usuários", async () => {
    const operador = (await login(app, "op@x.com", "op12345")).cookie;
    expect((await chamar("GET", "/usuarios")).statusCode).toBe(401);
    expect((await chamar("GET", "/usuarios", operador)).statusCode).toBe(403);
    expect(
      (await chamar("POST", "/usuarios", operador, { nome: "X", email: "x@x.com", papel: "admin" }))
        .statusCode,
    ).toBe(403);
    expect((await chamar("PATCH", "/usuarios/1", operador, { papel: "operador" })).statusCode).toBe(
      403,
    );
    expect((await chamar("POST", "/usuarios/1/convite", operador)).statusCode).toBe(403);
  });
});

describe("criação e primeiro acesso", () => {
  it("cria o usuário só com nome, e-mail e papel, sem senha", async () => {
    const { res, corpo, token } = await criar("  Carla Souza ", "CARLA@X.COM");
    expect(res.statusCode).toBe(201);
    expect(corpo.usuario).toMatchObject({
      nome: "Carla Souza",
      email: "carla@x.com",
      papel: "operador",
      ativo: true,
      pendente: true,
    });
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(JSON.stringify(corpo.usuario)).not.toMatch(/hash/i);
  });

  it("guarda só o hash do token, nunca o token", async () => {
    const { token } = await criar();
    const [linha] = await db.select().from(usuarios).where(eq(usuarios.email, "carla@x.com"));
    expect(linha?.conviteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(linha)).not.toContain(token);
  });

  it("recusa e-mail repetido, e-mail inválido e papel desconhecido", async () => {
    await criar();
    expect((await criar("Outra", "carla@x.com")).res.statusCode).toBe(409);
    expect((await criar("Outra", "nao-e-email")).res.statusCode).toBe(400);
    expect((await criar("Outra", "outra@x.com", "dono")).res.statusCode).toBe(400);
  });

  it("não deixa entrar antes de definir a senha", async () => {
    await criar();
    for (const senha of ["qualquer", "x", " "]) {
      expect((await login(app, "carla@x.com", senha)).res.statusCode).toBe(401);
    }
  });

  it("verifica o link e mostra a quem ele pertence", async () => {
    const { token } = await criar();
    const res = await chamar("POST", "/auth/convite/verificar", undefined, { token });
    expect(res.json()).toEqual({ nome: "Carla Souza", email: "carla@x.com", redefinicao: false });
    expect(
      (await chamar("POST", "/auth/convite/verificar", undefined, { token: "x".repeat(43) }))
        .statusCode,
    ).toBe(400);
  });

  it("o usuário define a senha, já entra logado e depois usa o login normal", async () => {
    const { token } = await criar();
    expect((await aceitar(token, "curta")).statusCode).toBe(400);

    const res = await aceitar(token, "senha-da-carla-1");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: expect.any(Number),
      nome: "Carla Souza",
      email: "carla@x.com",
      papel: "operador",
    });
    const cookie = `token=${res.cookies.find((c) => c.name === "token")!.value}`;
    expect((await chamar("GET", "/auth/me", cookie)).json().email).toBe("carla@x.com");

    expect((await login(app, "carla@x.com", "senha-da-carla-1")).res.statusCode).toBe(200);
    const lista = (await chamar("GET", "/usuarios", admin)).json().items;
    expect(lista.find((u: { email: string }) => u.email === "carla@x.com").pendente).toBe(false);
  });

  it("o link só funciona uma vez, inclusive com dois envios ao mesmo tempo", async () => {
    const { token } = await criar();
    const respostas = await Promise.all([
      aceitar(token, "senha-numero-um"),
      aceitar(token, "senha-numero-dois"),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 400]);

    const depois = await aceitar(token, "senha-numero-tres");
    expect(depois.statusCode).toBe(400);
    expect(depois.json().erro).toBe("Convite inválido ou expirado");
  });

  it("o link expira", async () => {
    const { token } = await criar();
    await db
      .update(usuarios)
      .set({ conviteExpiraEm: new Date(Date.now() - 1000).toISOString() })
      .where(eq(usuarios.email, "carla@x.com"));
    expect((await chamar("POST", "/auth/convite/verificar", undefined, { token })).statusCode).toBe(
      400,
    );
    expect((await aceitar(token, "senha-da-carla-1")).statusCode).toBe(400);
  });

  it("links de pessoas diferentes são diferentes", async () => {
    const a = await criar("A", "a@x.com");
    const b = await criar("B", "b@x.com");
    expect(a.token).not.toBe(b.token);
    expect((await aceitar(a.token, "senha-da-pessoa-a")).json().email).toBe("a@x.com");
  });
});

describe("desativar, reativar e papel", () => {
  async function ativar() {
    const { corpo, token } = await criar();
    const sessao = await aceitar(token, "senha-da-carla-1");
    return {
      id: corpo.usuario.id as number,
      cookie: `token=${sessao.cookies.find((c) => c.name === "token")!.value}`,
    };
  }

  it("desativar derruba a sessão na hora e bloqueia o login", async () => {
    const { id, cookie } = await ativar();
    expect((await chamar("GET", "/produtos", cookie)).statusCode).toBe(200);

    expect((await chamar("PATCH", `/usuarios/${id}`, admin, { ativo: false })).json().ativo).toBe(
      false,
    );
    expect((await chamar("GET", "/produtos", cookie)).statusCode).toBe(401);
    expect((await chamar("GET", "/auth/me", cookie)).statusCode).toBe(401);
    expect((await login(app, "carla@x.com", "senha-da-carla-1")).res.statusCode).toBe(401);
  });

  it("reativar devolve o acesso com a mesma senha", async () => {
    const { id } = await ativar();
    await chamar("PATCH", `/usuarios/${id}`, admin, { ativo: false });
    await chamar("PATCH", `/usuarios/${id}`, admin, { ativo: true });
    expect((await login(app, "carla@x.com", "senha-da-carla-1")).res.statusCode).toBe(200);
  });

  it("desativar invalida um link pendente", async () => {
    const { corpo, token } = await criar();
    await chamar("PATCH", `/usuarios/${corpo.usuario.id}`, admin, { ativo: false });
    expect((await aceitar(token, "senha-da-carla-1")).statusCode).toBe(400);
  });

  it("mudar o papel vale imediatamente, sem novo login", async () => {
    const { id, cookie } = await ativar();
    expect((await chamar("POST", "/categorias", cookie, { nome: "Nova" })).statusCode).toBe(403);
    await chamar("PATCH", `/usuarios/${id}`, admin, { papel: "admin" });
    expect((await chamar("POST", "/categorias", cookie, { nome: "Nova" })).statusCode).toBe(201);
    await chamar("PATCH", `/usuarios/${id}`, admin, { papel: "operador" });
    expect((await chamar("POST", "/categorias", cookie, { nome: "Outra" })).statusCode).toBe(403);
  });

  it("o administrador não pode se desativar nem mudar o próprio papel", async () => {
    const meuId = (await chamar("GET", "/auth/me", admin)).json().id;
    expect((await chamar("PATCH", `/usuarios/${meuId}`, admin, { ativo: false })).statusCode).toBe(
      409,
    );
    expect(
      (await chamar("PATCH", `/usuarios/${meuId}`, admin, { papel: "operador" })).statusCode,
    ).toBe(409);
    expect(
      (await chamar("PATCH", `/usuarios/${meuId}`, admin, { nome: "Novo Nome" })).json().nome,
    ).toBe("Novo Nome");
    expect((await chamar("GET", "/produtos", admin)).statusCode).toBe(200);
  });

  it("valida a atualização", async () => {
    const { id } = await ativar();
    expect((await chamar("PATCH", `/usuarios/${id}`, admin, {})).statusCode).toBe(400);
    expect((await chamar("PATCH", `/usuarios/${id}`, admin, { papel: "dono" })).statusCode).toBe(
      400,
    );
    expect((await chamar("PATCH", "/usuarios/9999", admin, { ativo: false })).statusCode).toBe(404);
  });
});

describe("revogação de sessões", () => {
  async function pessoaAtiva() {
    const { corpo, token } = await criar();
    await aceitar(token, "senha-da-carla-1");
    const sessao = await login(app, "carla@x.com", "senha-da-carla-1");
    return { id: corpo.usuario.id as number, cookie: sessao.cookie };
  }

  it("desativar e reativar não ressuscita a sessão antiga: é preciso entrar de novo", async () => {
    const { id, cookie } = await pessoaAtiva();
    await chamar("PATCH", `/usuarios/${id}`, admin, { ativo: false });
    await chamar("PATCH", `/usuarios/${id}`, admin, { ativo: true });
    expect((await chamar("GET", "/produtos", cookie)).statusCode).toBe(401);
    const novo = await login(app, "carla@x.com", "senha-da-carla-1");
    expect((await chamar("GET", "/produtos", novo.cookie)).statusCode).toBe(200);
  });

  it("trocar a própria senha encerra as outras sessões, mas mantém esta", async () => {
    const outraSessao = (await login(app, "admin@x.com", "admin123")).cookie;
    const res = await chamar("POST", "/auth/senha", admin, {
      senhaAtual: "admin123",
      novaSenha: "outra-senha-123",
    });
    expect(res.statusCode).toBe(204);

    expect((await chamar("GET", "/produtos", outraSessao)).statusCode).toBe(401);
    expect((await chamar("GET", "/produtos", admin)).statusCode).toBe(401); // cookie antigo
    const renovado = `token=${res.cookies.find((c) => c.name === "token")!.value}`;
    expect((await chamar("GET", "/produtos", renovado)).statusCode).toBe(200);
  });

  it("redefinir a senha pelo link encerra as sessões antigas da conta", async () => {
    const { id, cookie } = await pessoaAtiva();
    const novoLink = (await chamar("POST", `/usuarios/${id}/convite`, admin)).json().convite.token;
    expect((await chamar("GET", "/produtos", cookie)).statusCode).toBe(200); // vale até o link ser usado

    await aceitar(novoLink, "senha-nova-4567");
    expect((await chamar("GET", "/produtos", cookie)).statusCode).toBe(401);
  });

  it("tokens emitidos antes do contador existir continuam valendo até a conta ser alterada", async () => {
    const [{ id }] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, "op@x.com"));
    const legado = `token=${app.jwt.sign({ id: id!, papel: "operador" })}`; // sem o campo v
    expect((await chamar("GET", "/produtos", legado)).statusCode).toBe(200);

    await chamar("PATCH", `/usuarios/${id}`, admin, { ativo: false });
    await chamar("PATCH", `/usuarios/${id}`, admin, { ativo: true });
    expect((await chamar("GET", "/produtos", legado)).statusCode).toBe(401);
  });

  it("um token adulterado com versão futura não vale", async () => {
    const [{ id }] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, "op@x.com"));
    const adulterado = `token=${app.jwt.sign({ id: id!, papel: "operador", v: 99 })}`;
    expect((await chamar("GET", "/produtos", adulterado)).statusCode).toBe(401);
  });
});

describe("redefinição de senha", () => {
  it("gera novo link; a senha antiga vale até o link ser usado", async () => {
    const { corpo, token } = await criar();
    await aceitar(token, "senha-antiga-123");

    const res = await chamar("POST", `/usuarios/${corpo.usuario.id}/convite`, admin);
    expect(res.statusCode).toBe(200);
    const novo = res.json().convite.token as string;
    expect(JSON.stringify(res.json().usuario)).not.toMatch(/hash/i);

    expect(
      (await chamar("POST", "/auth/convite/verificar", undefined, { token: novo })).json()
        .redefinicao,
    ).toBe(true);
    expect((await login(app, "carla@x.com", "senha-antiga-123")).res.statusCode).toBe(200);

    await aceitar(novo, "senha-nova-4567");
    expect((await login(app, "carla@x.com", "senha-antiga-123")).res.statusCode).toBe(401);
    expect((await login(app, "carla@x.com", "senha-nova-4567")).res.statusCode).toBe(200);
  });

  it("um novo link invalida o anterior", async () => {
    const { corpo, token } = await criar();
    await chamar("POST", `/usuarios/${corpo.usuario.id}/convite`, admin);
    expect((await aceitar(token, "senha-da-carla-1")).statusCode).toBe(400);
  });

  it("não gera link para usuário inativo ou inexistente", async () => {
    const { corpo } = await criar();
    await chamar("PATCH", `/usuarios/${corpo.usuario.id}`, admin, { ativo: false });
    expect((await chamar("POST", `/usuarios/${corpo.usuario.id}/convite`, admin)).statusCode).toBe(
      409,
    );
    expect((await chamar("POST", "/usuarios/9999/convite", admin)).statusCode).toBe(404);
  });
});

describe("troca da própria senha", () => {
  it("exige a senha atual e uma nova senha válida e diferente", async () => {
    expect(
      (
        await chamar("POST", "/auth/senha", undefined, {
          senhaAtual: "admin123",
          novaSenha: "outra-senha-123",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await chamar("POST", "/auth/senha", admin, {
          senhaAtual: "errada",
          novaSenha: "outra-senha-123",
        })
      ).json().erro,
    ).toBe("Senha atual incorreta");
    expect(
      (await chamar("POST", "/auth/senha", admin, { senhaAtual: "admin123", novaSenha: "curta" }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await chamar("POST", "/auth/senha", admin, {
          senhaAtual: "admin123",
          novaSenha: "admin123",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("troca a senha: a antiga deixa de funcionar e a nova funciona", async () => {
    expect(
      (
        await chamar("POST", "/auth/senha", admin, {
          senhaAtual: "admin123",
          novaSenha: "outra-senha-123",
        })
      ).statusCode,
    ).toBe(204);
    expect((await login(app, "admin@x.com", "admin123")).res.statusCode).toBe(401);
    expect((await login(app, "admin@x.com", "outra-senha-123")).res.statusCode).toBe(200);
  });
});

describe("listagem", () => {
  it("lista todos com situação e sem segredos", async () => {
    await criar();
    const { items } = (await chamar("GET", "/usuarios", admin)).json();
    expect(items.map((u: { email: string }) => u.email)).toEqual([
      "admin@x.com",
      "carla@x.com",
      "op@x.com",
    ]);
    expect(items.find((u: { email: string }) => u.email === "carla@x.com")).toMatchObject({
      pendente: true,
      ativo: true,
    });
    expect(JSON.stringify(items)).not.toMatch(/hash|senha/i);
  });
});
