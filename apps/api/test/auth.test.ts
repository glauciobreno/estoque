import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp, login, type App } from "./helpers.js";

let app: App;
beforeAll(async () => (app = await criarApp()));
afterAll(() => app.close());

describe("autenticação", () => {
  it("responde no /health sem autenticação", async () => {
    const res = await app.inject({ url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  it("faz login e define cookie httpOnly", async () => {
    const { res } = await login(app, "admin@x.com", "admin123");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: "admin@x.com", papel: "admin" });
    expect(res.json()).not.toHaveProperty("senhaHash");
    expect(res.cookies[0]).toMatchObject({ name: "token", httpOnly: true });
  });

  it("aceita e-mail em maiúsculas", async () => {
    const { res } = await login(app, "ADMIN@X.COM", "admin123");
    expect(res.statusCode).toBe(200);
  });

  it("rejeita senha errada e e-mail inexistente com a mesma mensagem", async () => {
    const a = await login(app, "admin@x.com", "errada");
    const b = await login(app, "nao@existe.com", "qualquer");
    expect(a.res.statusCode).toBe(401);
    expect(b.res.statusCode).toBe(401);
    expect(a.res.json()).toEqual(b.res.json());
  });

  it("valida o corpo do login", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "x" } });
    expect(res.statusCode).toBe(400);
  });

  it("/auth/me exige cookie e devolve o usuário", async () => {
    expect((await app.inject({ url: "/auth/me" })).statusCode).toBe(401);
    const { cookie } = await login(app, "op@x.com", "op12345");
    const res = await app.inject({ url: "/auth/me", headers: { cookie } });
    expect(res.json()).toMatchObject({ email: "op@x.com", papel: "operador" });
  });

  it("logout limpa o cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/logout" });
    expect(res.statusCode).toBe(204);
    expect(res.cookies[0]).toMatchObject({ name: "token", value: "" });
  });
});
