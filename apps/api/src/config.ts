export type Config = {
  databaseUrl: string;
  databaseAuthToken?: string;
  jwtSecret: string;
  corsOrigins: string[];
  port: number;
  cookieSameSite: "lax" | "strict" | "none";
  cookieSecure: boolean;
  trustProxy: boolean;
  logLevel: string;
  /** Requisições por minuto e por IP: geral e para o login. */
  rateLimit: { max: number; loginMax: number };
};

const inteiro = (valor: string | undefined, padrao: number, nome: string) => {
  if (valor === undefined || valor === "") return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${nome} deve ser um inteiro positivo`);
  return n;
};

/** Só o necessário para falar com o banco (migrações e seed não precisam de segredo de sessão). */
export function loadDbConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    databaseUrl: env.TURSO_DATABASE_URL ?? "file:local.db",
    databaseAuthToken: env.TURSO_AUTH_TOKEN || undefined,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const producao = env.NODE_ENV === "production";
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || (producao && jwtSecret.length < 32)) {
    throw new Error("JWT_SECRET ausente (em produção, mínimo de 32 caracteres)");
  }

  const sameSite = env.COOKIE_SAMESITE ?? "lax";
  if (sameSite !== "lax" && sameSite !== "strict" && sameSite !== "none") {
    throw new Error("COOKIE_SAMESITE deve ser lax, strict ou none");
  }

  // Com credenciais, o navegador não aceita "*"; também seria uma brecha de CSRF.
  const corsOrigins = (env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origem) => origem.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.includes("*")) {
    throw new Error("CORS_ORIGIN deve listar origens explícitas (sem '*')");
  }

  return {
    ...loadDbConfig(env),
    jwtSecret,
    corsOrigins,
    port: Number(env.PORT ?? 3000),
    cookieSameSite: sameSite,
    cookieSecure: sameSite === "none" || producao,
    trustProxy: env.TRUST_PROXY === "true",
    logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : "info"),
    rateLimit: {
      max: inteiro(env.RATE_LIMIT_MAX, 300, "RATE_LIMIT_MAX"),
      loginMax: inteiro(env.RATE_LIMIT_LOGIN_MAX, 10, "RATE_LIMIT_LOGIN_MAX"),
    },
  };
}
