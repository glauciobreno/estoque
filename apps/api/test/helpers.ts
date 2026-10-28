import { hash } from "bcryptjs";
import { buildApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { aplicarMigrations } from "../src/db/migrate.js";
import { usuarios } from "../src/db/schema.js";

export const config: Config = {
  databaseUrl: ":memory:",
  jwtSecret: "segredo-de-teste-com-mais-de-32-caracteres",
  corsOrigins: ["http://localhost:5173"],
  port: 0,
  cookieSameSite: "lax",
  cookieSecure: false,
  trustProxy: false,
  logLevel: "silent",
  rateLimit: { max: 10_000, loginMax: 10_000 },
};

export async function criarApp(sobrescrever: Partial<Config> = {}, db = createDb(":memory:")) {
  await aplicarMigrations(db);
  await db.insert(usuarios).values([
    { nome: "Admin", email: "admin@x.com", senhaHash: await hash("admin123", 4), papel: "admin" },
    { nome: "Op", email: "op@x.com", senhaHash: await hash("op12345", 4), papel: "operador" },
  ]);
  const app = await buildApp({ db, config: { ...config, ...sobrescrever } });
  return app;
}

export type App = Awaited<ReturnType<typeof criarApp>>;

export async function login(app: App, email: string, senha: string) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, senha } });
  const cookie = res.cookies.find((c) => c.name === "token");
  return { res, cookie: cookie ? `token=${cookie.value}` : "" };
}
