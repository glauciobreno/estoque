export type Config = {
  databaseUrl: string;
  databaseAuthToken?: string;
  jwtSecret: string;
  corsOrigin: string;
  port: number;
  cookieSameSite: "lax" | "strict" | "none";
  cookieSecure: boolean;
};

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
  return {
    databaseUrl: env.TURSO_DATABASE_URL ?? "file:local.db",
    databaseAuthToken: env.TURSO_AUTH_TOKEN || undefined,
    jwtSecret,
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:5173",
    port: Number(env.PORT ?? 3000),
    cookieSameSite: sameSite,
    cookieSecure: sameSite === "none" || producao,
  };
}
