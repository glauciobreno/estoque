# Deploy: Vercel + Turso

## Como as peças se encaixam

```
Navegador ──► projeto web (Vercel, estático)
                 │  /api/*  (rewrite, definido em apps/web/vercel.json)
                 ▼
              projeto api (Vercel Function, Fastify) ──► Turso (libSQL)
```

O navegador só conversa com **um** endereço (o do site). A Vercel encaminha `/api/*` para a API, então o cookie de sessão é do próprio site (`SameSite=Lax`, sem CORS no dia a dia).

> **Por que não chamar a API direto por outro domínio?** `*.vercel.app` é um sufixo público: `estoque-web.vercel.app` e `estoque-api.vercel.app` são _sites diferentes_, e o cookie da API viraria cookie de terceiros, bloqueado pelo Safari e cada vez mais pelo Chrome. O proxy evita o problema sem precisar de domínio próprio. Se você usar um domínio próprio com subdomínios (`app.seudominio.com` e `api.seudominio.com`), também funciona direto: defina `VITE_API_URL` no projeto web e ajuste a CSP em `apps/web/vercel.json` (`connect-src`).

Cada push na `main` publica sozinho. Pull requests ganham URLs de preview, mas **o preview não consegue escrever na API de produção**: a API recusa a origem (`CORS_ORIGIN` lista só o site oficial). É o comportamento desejado.

## Antes de começar

Contas no GitHub (já tem), [Vercel](https://vercel.com) e [Turso](https://turso.tech), e a CLI do Turso:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
```

## 1. Banco no Turso

```bash
turso db create estoque
turso db show estoque --url          # → TURSO_DATABASE_URL (libsql://...)
turso db tokens create estoque       # → TURSO_AUTH_TOKEN
```

Escolha uma região próxima da região das funções da Vercel (padrão: Washington, `iad1`). Guarde a URL e o token; o token não deve ir para o repositório nem para o chat.

## 2. Migrações pelo GitHub Actions

1. No repositório: **Settings → Environments → New environment** → `production`.
2. Nesse ambiente, adicione os _secrets_ `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`.
3. **Actions → Migrar banco → Run workflow** para criar as tabelas pela primeira vez.

Depois disso, o workflow roda sozinho sempre que `apps/api/drizzle/**` ou `apps/api/src/db/**` mudarem na `main`. Como a Vercel publica a API no mesmo push, **escreva migrações compatíveis com a versão anterior do código** (adicionar colunas e tabelas, nunca renomear ou remover no mesmo passo). Para mudanças destrutivas, faça em duas etapas: publica o código que não usa mais a coluna e, num segundo momento, remove a coluna.

## 3. Primeiro administrador

No seu computador (a senha tem de ter pelo menos 10 caracteres):

```bash
read -rs ADMIN_SENHA && export ADMIN_SENHA     # digita sem aparecer no histórico
TURSO_DATABASE_URL='libsql://...' TURSO_AUTH_TOKEN='...' \
ADMIN_NOME='Seu Nome' ADMIN_EMAIL='voce@exemplo.com' \
npm run db:seed -w @estoque/api
```

## 4. Projeto da API na Vercel

1. **Add New → Project**, importe `glauciobreno/estoque`.
2. **Root Directory:** `apps/api`. Mantenha ativada a opção _Include source files outside of the Root Directory_ (o pacote `packages/shared` fica fora da pasta).
3. **Framework Preset:** Fastify (detectado sozinho; ponto de entrada `src/server.ts`).
4. **Environment Variables** (ambiente _Production_):

   | Variável             | Valor                                                                 |
   | -------------------- | --------------------------------------------------------------------- |
   | `TURSO_DATABASE_URL` | URL do passo 1                                                        |
   | `TURSO_AUTH_TOKEN`   | token do passo 1                                                      |
   | `JWT_SECRET`         | `openssl rand -base64 48` (mínimo de 32 caracteres)                   |
   | `CORS_ORIGIN`        | URL do site, ex. `https://estoque-web.vercel.app` (ajuste no passo 6) |
   | `TRUST_PROXY`        | `true`                                                                |
   | `NODE_ENV`           | `production`                                                          |

   `COOKIE_SAMESITE` fica no padrão (`lax`). `NODE_ENV=production` ativa o cookie `Secure` e exige o segredo de 32+ caracteres; a Vercel já o define em produção, e declará-lo evita depender disso.

5. Em **Settings → Functions**, escolha a região mais próxima do Turso.
6. **Deploy**. Anote o endereço da API e teste: `curl https://SEU-API.vercel.app/health/ready` deve devolver `{"status":"ok","banco":"ok"}`.

## 5. Projeto web na Vercel

1. Em `apps/web/vercel.json`, troque `SEU-PROJETO-API.vercel.app` pelo endereço (host) da API do passo 4 e faça commit na `main`.
2. **Add New → Project**, importe o mesmo repositório de novo. **Root Directory:** `apps/web`. Framework: Vite (padrões: `npm run build`, saída `dist`).
3. **Deploy**. Anote o endereço do site.

O `vercel.json` do web também define o fallback do SPA (rotas como `/produtos` abrem direto) e os cabeçalhos de segurança, incluindo a Content-Security-Policy.

## 6. Fechar o círculo (CORS)

Volte ao projeto da API, ajuste `CORS_ORIGIN` para o endereço real do site (aceita lista separada por vírgula, sem `*`) e faça **Redeploy** (variáveis só valem em novos deploys).

## 7. Verificar

```bash
SMOKE_EMAIL='voce@exemplo.com' SMOKE_SENHA='...' npm run smoke -- https://SEU-SITE.vercel.app
```

O script confere o site, o proxy `/api`, a conexão com o banco, os cabeçalhos de segurança, o `CORS_ORIGIN`, o login e o cookie. Cada falha diz o que ajustar. Sem as variáveis `SMOKE_*`, ele pula a parte de login.

## Domínio próprio (opcional)

**Settings → Domains** no projeto web. O HTTPS é automático. Inclua o novo endereço em `CORS_ORIGIN` na API e faça o redeploy.

## Backup e recuperação

- Cópia manual: `turso db shell estoque .dump > backup-$(date +%F).sql`. Guarde fora do repositório (contém dados reais).
- Confira no painel do Turso o que o seu plano oferece de restauração a um ponto no tempo.
- Reverter código: Vercel → **Deployments** → o deploy anterior → **Promote to Production** (ou _Instant Rollback_).

## Problemas comuns

| Sintoma                                                   | Causa provável                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/api/...` responde 404 ou 502                            | O destino do rewrite em `apps/web/vercel.json` está errado, ou a API não foi publicada      |
| `403 Origem não permitida`                                | `CORS_ORIGIN` na API não é exatamente a URL do site (esquema, subdomínio, sem barra no fim) |
| `/api/health/ready` dá 503                                | `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` errados na API, ou migrações não aplicadas          |
| Login funciona e cai logo depois                          | `VITE_API_URL` apontando para outro site (cookie de terceiros). Remova-o e use o proxy      |
| `429` cedo demais                                         | Falta `TRUST_PROXY=true`: todo mundo parece ter o mesmo IP                                  |
| Erro 500 com um código na tela                            | Procure esse código (`requestId`) em **Runtime Logs** da API na Vercel                      |
| Falha de conexão com `libsql://` em função serverless     | Use a URL com `https://` no lugar de `libsql://` (mesmo host); o cliente passa a usar HTTP  |
| O build da API reclama de TypeScript do `packages/shared` | Compile o pacote para JS (`tsc`, `main` apontando para `dist`) ou use a alternativa abaixo  |

### Alternativa sem Vercel para a API

A API é um servidor Node comum (`npm run start -w @estoque/api`, porta em `PORT`). Funciona igual em Render, Railway ou Fly.io com as mesmas variáveis de ambiente. Nesse caso, mantenha o proxy `/api` do projeto web apontando para o endereço desse serviço.
