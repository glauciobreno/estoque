import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, loadDbConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { criarApp, login, type App } from "./helpers.js";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const ORIGEM = "http://localhost:5173";

describe("cabeçalhos e identificação de requisições", () => {
  it("envia cabeçalhos de segurança do helmet", async () => {
    app = await criarApp();
    const res = await app.inject({ url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("devolve um x-request-id único por requisição", async () => {
    app = await criarApp();
    const a = await app.inject({ url: "/health" });
    const b = await app.inject({ url: "/health" });
    expect(a.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers["x-request-id"]).not.toBe(b.headers["x-request-id"]);
  });

  it("responde 404 em JSON para rotas inexistentes", async () => {
    app = await criarApp();
    const res = await app.inject({ url: "/nao-existe" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ erro: "Rota não encontrada" });
  });
});

describe("saúde", () => {
  it("/health/ready confirma o acesso ao banco, sem exigir login", async () => {
    app = await criarApp();
    const res = await app.inject({ url: "/health/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", banco: "ok" });
  });

  it("/health/ready responde 503 sem detalhes quando o banco falha", async () => {
    const db = createDb(":memory:");
    app = await criarApp({}, db);
    db.run = () => Promise.reject(new Error("SQLITE_CANTOPEN: segredo-interno"));
    const res = await app.inject({ url: "/health/ready" });
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toMatch(/SQLITE|segredo/);
    expect(res.json().requestId).toBe(res.headers["x-request-id"]);
  });
});

describe("CORS e proteção contra CSRF", () => {
  it("libera a origem configurada com credenciais", async () => {
    app = await criarApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/produtos",
      headers: { origin: ORIGEM, "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGEM);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("não libera origens desconhecidas", async () => {
    app = await criarApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/produtos",
      headers: { origin: "https://malicioso.com", "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("bloqueia escrita vinda de outra origem, mesmo com sessão válida", async () => {
    app = await criarApp();
    const { cookie } = await login(app, "admin@x.com", "admin123");
    const res = await app.inject({
      method: "POST",
      url: "/categorias",
      payload: { nome: "Invasora" },
      headers: { cookie, origin: "https://malicioso.com" },
    });
    expect(res.statusCode).toBe(403);
    const lista = await app.inject({ url: "/categorias", headers: { cookie } });
    expect(lista.json().total).toBe(0);
  });

  it("aceita escrita da origem do front e de clientes sem Origin", async () => {
    app = await criarApp();
    const { cookie } = await login(app, "admin@x.com", "admin123");
    const doFront = await app.inject({
      method: "POST",
      url: "/categorias",
      payload: { nome: "A" },
      headers: { cookie, origin: ORIGEM },
    });
    const semOrigem = await app.inject({
      method: "POST",
      url: "/categorias",
      payload: { nome: "B" },
      headers: { cookie },
    });
    expect([doFront.statusCode, semOrigem.statusCode]).toEqual([201, 201]);
  });

  it("leituras de qualquer origem não passam pela checagem de escrita", async () => {
    app = await criarApp();
    const res = await app.inject({ url: "/health", headers: { origin: "https://outro.com" } });
    expect(res.statusCode).toBe(200);
  });
});

describe("limite de requisições", () => {
  it("limita tentativas de login por IP e informa quando tentar de novo", async () => {
    app = await criarApp({ rateLimit: { max: 10_000, loginMax: 3 } });
    const codigos: number[] = [];
    for (let i = 0; i < 5; i++)
      codigos.push((await login(app, "admin@x.com", "errada")).res.statusCode);
    expect(codigos).toEqual([401, 401, 401, 429, 429]);

    const bloqueada = await login(app, "admin@x.com", "admin123");
    expect(bloqueada.res.statusCode).toBe(429);
    expect(bloqueada.res.json().erro).toMatch(/Muitas requisições/);
    expect(bloqueada.res.headers["retry-after"]).toBeDefined();
  });

  it("aplica o limite geral às demais rotas, exceto /health", async () => {
    app = await criarApp({ rateLimit: { max: 3, loginMax: 10_000 } });
    const { cookie } = await login(app, "admin@x.com", "admin123");
    const codigos: number[] = [];
    for (let i = 0; i < 4; i++)
      codigos.push((await app.inject({ url: "/produtos", headers: { cookie } })).statusCode);
    expect(codigos).toEqual([200, 200, 200, 429]);
    for (let i = 0; i < 10; i++)
      expect((await app.inject({ url: "/health" })).statusCode).toBe(200);
  });
});

describe("corpos de requisição inválidos", () => {
  it("rejeita JSON malformado em português", async () => {
    app = await criarApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: "{nao-e-json",
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().erro).toMatch(/JSON válido/);
  });

  it("rejeita corpo grande demais", async () => {
    app = await criarApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "a@b.com", senha: "x".repeat(200_000) },
    });
    expect(res.statusCode).toBe(413);
  });

  it("rejeita tipo de conteúdo não suportado", async () => {
    app = await criarApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: "a=1",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(res.statusCode).toBe(415);
  });

  it("não deixa uma sessão sem corpo derrubar a rota", async () => {
    app = await criarApp();
    const { cookie } = await login(app, "admin@x.com", "admin123");
    const res = await app.inject({ method: "POST", url: "/categorias", headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });
});

describe("erros internos", () => {
  it("responde 500 sem vazar detalhes e com o id da requisição para o suporte", async () => {
    const db = createDb(":memory:");
    app = await criarApp({}, db);
    const { cookie } = await login(app, "admin@x.com", "admin123");
    await db.run(sql`drop table categorias`);

    const res = await app.inject({ url: "/categorias", headers: { cookie } });
    expect(res.statusCode).toBe(500);
    const corpo = res.json();
    expect(corpo.erro).toBe("Erro interno");
    expect(corpo.requestId).toBe(res.headers["x-request-id"]);
    expect(res.body).not.toMatch(/sql|categorias|no such table/i);
  });
});

describe("loadDbConfig", () => {
  it("não exige JWT_SECRET (migrações e seed só precisam do banco)", () => {
    expect(
      loadDbConfig({ TURSO_DATABASE_URL: "libsql://x.turso.io", TURSO_AUTH_TOKEN: "t" }),
    ).toEqual({
      databaseUrl: "libsql://x.turso.io",
      databaseAuthToken: "t",
    });
    expect(loadDbConfig({})).toEqual({
      databaseUrl: "file:local.db",
      databaseAuthToken: undefined,
    });
  });
});

describe("loadConfig", () => {
  const base = { JWT_SECRET: "x".repeat(32) };

  it("lê várias origens e remove a barra final", () => {
    const config = loadConfig({ ...base, CORS_ORIGIN: "https://app.com/, https://www.app.com" });
    expect(config.corsOrigins).toEqual(["https://app.com", "https://www.app.com"]);
  });

  it("recusa CORS curinga", () => {
    expect(() => loadConfig({ ...base, CORS_ORIGIN: "*" })).toThrow(/CORS_ORIGIN/);
    expect(() => loadConfig({ ...base, CORS_ORIGIN: "https://a.com,*" })).toThrow(/CORS_ORIGIN/);
  });

  it("exige segredo forte em produção", () => {
    expect(() => loadConfig({ NODE_ENV: "production", JWT_SECRET: "curto" })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: "production", JWT_SECRET: "x".repeat(32) })).not.toThrow();
  });

  it("usa cookie seguro em produção e com SameSite=none", () => {
    expect(loadConfig({ ...base, NODE_ENV: "production" }).cookieSecure).toBe(true);
    expect(loadConfig({ ...base, COOKIE_SAMESITE: "none" }).cookieSecure).toBe(true);
    expect(loadConfig(base).cookieSecure).toBe(false);
  });

  it("valida os limites numéricos", () => {
    expect(loadConfig({ ...base, RATE_LIMIT_LOGIN_MAX: "5" }).rateLimit.loginMax).toBe(5);
    expect(() => loadConfig({ ...base, RATE_LIMIT_MAX: "abc" })).toThrow(/RATE_LIMIT_MAX/);
    expect(() => loadConfig({ ...base, RATE_LIMIT_MAX: "0" })).toThrow(/RATE_LIMIT_MAX/);
  });
});
