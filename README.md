# Sistema de Gerenciamento de Estoque

Sistema web para controle de estoque: cadastro de produtos, categorias e fornecedores, movimentações (entrada, saída e ajuste), alertas de estoque mínimo e dashboard.

## Stack

| Camada       | Tecnologia                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Estrutura    | Monorepo (npm workspaces): `apps/web`, `apps/api`, `packages/shared`                                 |
| Frontend     | React + Vite + TypeScript, TanStack Query, React Router, React Hook Form + Zod, Tailwind + shadcn/ui |
| Backend      | Node 22 + Fastify + TypeScript + Zod                                                                 |
| Banco        | [Turso](https://turso.tech) (libSQL/SQLite) via `@libsql/client` + Drizzle ORM + drizzle-kit         |
| Autenticação | JWT em cookie httpOnly + argon2/bcrypt, papéis (admin, operador)                                     |
| Testes       | Vitest (unidade e API) + Playwright (E2E)                                                            |
| Deploy       | Vercel (front e API) + Turso (banco)                                                                 |

## Modelo de dados inicial

- `usuarios` (id, nome, email, senha_hash, papel)
- `categorias` (id, nome)
- `fornecedores` (id, nome, contato)
- `produtos` (id, sku único, nome, categoria_id, unidade, preço_custo, preço_venda, estoque_minimo, saldo_atual, ativo)
- `movimentacoes` (id, produto_id, tipo [entrada|saída|ajuste], quantidade, motivo, fornecedor_id?, usuario_id, criado_em)

> Toda movimentação é um registro imutável, gravado dentro de uma transação. O saldo nunca fica negativo e nunca diverge do histórico.

## Fases do projeto

### Fase 0: Fundação (1–2 dias)

- [x] Monorepo, TypeScript, ESLint/Prettier, `.env.example`
- [x] GitHub Actions com lint, typecheck e testes
- [ ] Criar o banco no Turso (`turso db create`) e gerar o token

### Fase 1: Backend base (2–3 dias)

- [x] Schema Drizzle e primeira migration
- [x] API exportando o `app` separado do `listen()` (roda local e como função serverless)
- [x] Autenticação (login, logout, middleware de papéis)
- [x] CRUD de categorias, fornecedores e produtos, com paginação, busca e filtros

### Fase 2: Núcleo de estoque (2–3 dias)

- [x] Endpoint de movimentações transacionais, com bloqueio de saldo negativo
- [x] Histórico de movimentações por produto
- [x] Alerta de estoque mínimo
- [x] Testes unitários da regra de saldo

### Fase 3: Frontend (4–5 dias)

- [x] Layout, login e rotas protegidas
- [x] Telas de produtos, categorias e fornecedores
- [x] Tela de movimentações (entrada, saída e ajuste)
- [x] Dashboard: itens abaixo do mínimo, últimas movimentações, valor total em estoque

### Fase 4: Extras (opcional, 2–3 dias)

- [ ] Exportação CSV
- [ ] Importação de produtos por planilha
- [ ] Relatórios por período
- [ ] Código de barras

### Fase 5: Qualidade e segurança (1–2 dias)

- [x] Testes E2E dos fluxos críticos (login, cadastrar produto, entrada e saída)
- [x] Rate limit, helmet, CORS restrito, validação em todas as rotas
- [x] Tratamento de erros e logs

### Fase 6: Deploy (1 dia)

Passo a passo completo em [`docs/DEPLOY.md`](docs/DEPLOY.md).

- [x] Configuração do projeto `web` (`apps/web/vercel.json`): proxy `/api`, fallback do SPA e cabeçalhos de segurança com CSP
- [x] API pronta para a Vercel (Fastify, ponto de entrada `src/server.ts`) e variáveis de ambiente documentadas
- [x] Migrations do Drizzle rodando no CI (workflow `Migrar banco`, ambiente `production`)
- [x] Endpoints `/health` e `/health/ready` (este confirma o acesso ao banco) e `npm run smoke` para verificar o site publicado
- [ ] Criar o banco no Turso e os _secrets_ `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` no ambiente `production` do GitHub _(ação do dono do repositório)_
- [ ] Criar os projetos `api` (root `apps/api`) e `web` (root `apps/web`) na Vercel e cadastrar as variáveis _(ação do dono)_
- [ ] Deploy automático a partir da `main` (a Vercel faz ao conectar o repositório) e domínio/HTTPS (automático; domínio próprio opcional)
- [ ] Verificar a política de backup do plano do Turso

**Estimativa do MVP** (fases 0 a 3, 5 e 6): cerca de 2 a 3 semanas em tempo parcial.

## Fluxo de trabalho

- Branch `main` protegida; mudanças por PR a partir de `feature/*`
- Commits no padrão Conventional Commits
- Nunca commitar `.env` ou `*.db`

## Riscos e cuidados

- **Cookies entre domínios:** em `*.vercel.app` o cookie da API seria de terceiros (bloqueado no Safari). Por isso o site encaminha `/api` para a API (mesma origem). Detalhes em `docs/DEPLOY.md`.
- **Cold start** das funções serverless na primeira requisição.
- **Concorrência:** usar transações do libSQL nas movimentações.
- **Escopo:** multi-depósito, lotes/validade e pedidos de compra ficam fora do MVP.

## Desenvolvimento local

Requer Node 22 (`.nvmrc`).

```bash
npm install
cp .env.example .env   # ajuste os valores
npm run lint && npm run typecheck && npm test

npm run db:migrate -w @estoque/api   # aplica as migrations
npm run db:seed -w @estoque/api      # cria o admin (ADMIN_EMAIL / ADMIN_SENHA)
npm run dev -w @estoque/api          # API em http://localhost:3000
```

Após alterar `apps/api/src/db/schema.ts`, gere a migration com `npm run db:generate -w @estoque/api` e commite a pasta `apps/api/drizzle`.

### API (Fase 1)

| Rota                                                       | Acesso                          |
| ---------------------------------------------------------- | ------------------------------- |
| `GET /health`                                              | público                         |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`    | login público; `me` autenticado |
| `GET /categorias`, `/fornecedores`, `/produtos` (+ `/:id`) | qualquer usuário autenticado    |
| `POST`, `PUT`, `DELETE` nesses recursos                    | somente `admin`                 |

Listagens aceitam `q`, `page` e `pageSize` (máx. 100); `/produtos` também aceita `categoriaId`, `ativo` e `abaixoDoMinimo`. Preços são inteiros em centavos. O saldo do produto só muda por movimentações.

### Estoque (Fase 2)

| Rota                                                               | Acesso                       |
| ------------------------------------------------------------------ | ---------------------------- |
| `POST /movimentacoes`                                              | qualquer usuário autenticado |
| `GET /movimentacoes` (`produtoId`, `tipo`, `de`, `ate`, paginação) | autenticado                  |
| `GET /produtos/:id/movimentacoes`                                  | autenticado                  |
| `GET /estoque/alertas`                                             | autenticado                  |

- **Entrada** e **saída** informam `quantidade` (inteiro positivo); a entrada aceita `fornecedorId`.
- **Ajuste** informa `novoSaldo` (a contagem) e exige `motivo`.
- A `quantidade` gravada é sempre a variação aplicada ao saldo (entrada +, saída −, ajuste ±), então `saldo_atual` é a soma das movimentações.
- Movimentação e saldo são gravados na mesma transação; saída acima do saldo retorna 409 e não grava nada. Movimentações são imutáveis: correções são novos ajustes.
- Alertas listam produtos **ativos** com `estoqueMinimo > 0` e saldo menor ou igual ao mínimo (o mesmo critério do filtro `abaixoDoMinimo` em `/produtos`).

### Frontend (Fase 3)

```bash
npm run dev -w @estoque/api   # API em :3000
npm run dev -w @estoque/web   # app em http://localhost:5173
```

Em desenvolvimento o Vite encaminha `/api/*` para a API (`API_PROXY_TARGET`, padrão `http://localhost:3000`), então front e API ficam na mesma origem, sem CORS e com cookie de sessão. Em produção defina `VITE_API_URL` com a URL da API (e `COOKIE_SAMESITE=none` se os domínios forem diferentes).

- **Telas:** login, dashboard, produtos (lista, filtros, detalhe com histórico), movimentações, categorias e fornecedores.
- **Permissões:** o operador lê tudo e registra movimentações; criar, editar e excluir cadastros aparece só para o `admin` (a API também exige).
- **Estado na URL:** busca, filtros e página ficam na query string, então os links são compartilháveis e o botão voltar funciona.
- **Valores monetários** são digitados em reais (`12,50`) e trafegam em centavos.

### Qualidade e segurança (Fase 5)

**Testes E2E** (Playwright, contra a API real e o build de produção do front, com um banco SQLite descartável):

```bash
npx playwright install chromium   # uma vez
npm run test:e2e
```

Cobrem login e sessão, o fluxo completo de estoque (cadastro, entrada, saída, saldo insuficiente, ajuste, histórico, alerta) e as permissões do operador. Se o Chromium já estiver instalado em outro caminho, use `PLAYWRIGHT_CHROMIUM_PATH`. No CI eles rodam num job próprio, depois das verificações rápidas.

**Segurança da API**

| Proteção              | Como funciona                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Cabeçalhos            | `@fastify/helmet` (HSTS, `nosniff`, etc.)                                                                                               |
| Limite de requisições | 300/min por IP no geral e 10/min no login (`RATE_LIMIT_*`); `/health` fica de fora. Com a API atrás de proxy, defina `TRUST_PROXY=true` |
| CORS                  | Só as origens de `CORS_ORIGIN`, com credenciais; curinga é recusado na inicialização                                                    |
| CSRF                  | Cookie `httpOnly` + `SameSite`, e escritas (POST/PUT/DELETE) com `Origin` diferente das permitidas recebem 403                          |
| Validação             | Corpo, parâmetros e query validados com Zod em todas as rotas; corpo limitado a 100 KB                                                  |
| Senhas e sessão       | bcrypt; login com a mesma mensagem e tempo de resposta para e-mail inexistente e senha errada; JWT de 7 dias em cookie                  |

**Erros e logs**

- Toda resposta traz `x-request-id`; erros 5xx devolvem `{ erro: "Erro interno", requestId }` sem detalhes internos, e o mesmo id aparece no log. O front mostra o código ao usuário para facilitar o suporte.
- Logs em JSON (pino), com `cookie`, `authorization` e `set-cookie` ocultados; nível em `LOG_LEVEL`.
- No front: sessão expirada leva ao login com aviso, falha de rede e indisponibilidade têm mensagens próprias, e um error boundary evita tela em branco.

**Limitações conhecidas**

- O limite de requisições fica na memória de cada instância; em ambiente serverless, com várias instâncias, ele é aproximado.
- O JWT não é revogável antes de expirar (7 dias): sair limpa o cookie, mas um token copiado continua válido até o fim. Não há gestão de usuários ainda; ao criá-la, convém reconferir o papel no banco a cada requisição.

### Banco (Turso)

```bash
turso db create estoque
turso db show estoque --url        # TURSO_DATABASE_URL
turso db tokens create estoque     # TURSO_AUTH_TOKEN
```

Em desenvolvimento local, `TURSO_DATABASE_URL=file:local.db` dispensa o Turso.
