/**
 * Verificação pós-deploy: confere o site publicado de ponta a ponta, passando pelo mesmo caminho
 * do navegador (site → proxy /api → API → banco).
 *
 *   npm run smoke -- https://seu-site.vercel.app
 *   SMOKE_EMAIL=... SMOKE_SENHA=... npm run smoke -- https://seu-site.vercel.app   # inclui login
 */
const base = process.argv[2]?.replace(/\/$/, "");
if (!base || !/^https?:\/\//.test(base)) {
  console.error("Uso: npm run smoke -- <url do site, ex.: https://estoque.vercel.app>");
  process.exit(2);
}

const email = process.env.SMOKE_EMAIL;
const senha = process.env.SMOKE_SENHA;
let falhas = 0;

async function verificar(nome: string, teste: () => Promise<string | void>) {
  try {
    const detalhe = await teste();
    console.log(`  ✓ ${nome}${detalhe ? ` (${detalhe})` : ""}`);
  } catch (erro) {
    falhas++;
    console.log(`  ✗ ${nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
}

function esperar(condicao: boolean, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem);
}

const get = (caminho: string, init?: RequestInit) =>
  fetch(base + caminho, { redirect: "manual", ...init });
const json = (caminho: string, corpo: unknown, headers: Record<string, string> = {}) =>
  fetch(base + caminho, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(corpo),
  });

console.log(`Verificando ${base}\n`);

console.log("Site");
await verificar("página inicial carrega", async () => {
  const res = await get("/");
  esperar(res.status === 200, `status ${res.status}`);
  esperar((await res.text()).includes('id="root"'), "HTML sem o elemento #root");
});
await verificar("rota interna abre direto (fallback do SPA)", async () => {
  const res = await get("/produtos");
  esperar(res.status === 200, `status ${res.status}; o rewrite /(.*) → /index.html está ativo?`);
});
await verificar("cabeçalhos de segurança", async () => {
  const res = await get("/");
  esperar(!!res.headers.get("content-security-policy"), "sem Content-Security-Policy");
  esperar(res.headers.get("x-content-type-options") === "nosniff", "sem X-Content-Type-Options");
  esperar(res.headers.get("x-frame-options") === "DENY", "sem X-Frame-Options");
});

console.log("\nAPI (via /api)");
await verificar("/api/health", async () => {
  const res = await get("/api/health");
  esperar(
    res.status === 200,
    `status ${res.status}; o destino do rewrite em apps/web/vercel.json está correto?`,
  );
  esperar(((await res.json()) as { status?: string }).status === "ok", "resposta inesperada");
});
await verificar("/api/health/ready alcança o banco", async () => {
  const res = await get("/api/health/ready");
  esperar(
    res.status === 200,
    `status ${res.status}; confira TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na API`,
  );
});
await verificar("rotas protegidas exigem login", async () => {
  const res = await get("/api/produtos");
  esperar(res.status === 401, `esperado 401, recebido ${res.status}`);
});
await verificar("resposta traz x-request-id e helmet", async () => {
  const res = await get("/api/health");
  esperar(!!res.headers.get("x-request-id"), "sem x-request-id");
  esperar(res.headers.get("x-content-type-options") === "nosniff", "sem cabeçalhos do helmet");
});
await verificar("escrita de outra origem é recusada", async () => {
  const res = await json(
    "/api/auth/login",
    { email: "a@b.com", senha: "x" },
    { origin: "https://site-malicioso.example" },
  );
  esperar(res.status === 403, `esperado 403, recebido ${res.status}`);
});
await verificar("CORS_ORIGIN da API aceita este site", async () => {
  const res = await json(
    "/api/auth/login",
    { email: "nao@existe.test", senha: "x" },
    { origin: new URL(base).origin },
  );
  esperar(
    res.status !== 403,
    "403 Origem não permitida: ajuste CORS_ORIGIN na API para a URL deste site",
  );
  esperar(res.status === 401, `esperado 401 (credenciais inválidas), recebido ${res.status}`);
});

if (email && senha) {
  console.log("\nSessão");
  let cookie = "";
  await verificar("login funciona e o cookie é seguro", async () => {
    const res = await json("/api/auth/login", { email, senha }, { origin: new URL(base).origin });
    esperar(res.status === 200, `status ${res.status}`);
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("token="));
    esperar(!!setCookie, "sem cookie de sessão");
    esperar(/httponly/i.test(setCookie), "cookie sem HttpOnly");
    if (base.startsWith("https://")) esperar(/secure/i.test(setCookie), "cookie sem Secure");
    cookie = setCookie.split(";")[0] ?? "";
  });
  await verificar("sessão é reconhecida e lista dados", async () => {
    const me = await get("/api/auth/me", { headers: { cookie } });
    esperar(me.status === 200, `/auth/me status ${me.status}`);
    const resumo = await get("/api/estoque/resumo", { headers: { cookie } });
    esperar(resumo.status === 200, `/estoque/resumo status ${resumo.status}`);
  });
} else {
  console.log("\n(Defina SMOKE_EMAIL e SMOKE_SENHA para também testar login e sessão.)");
}

console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} verificação(ões) falharam.`);
process.exit(falhas === 0 ? 0 : 1);

export {};
