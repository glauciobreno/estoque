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

- [ ] Layout, login e rotas protegidas
- [ ] Telas de produtos, categorias e fornecedores
- [ ] Tela de movimentações (entrada, saída e ajuste)
- [ ] Dashboard: itens abaixo do mínimo, últimas movimentações, valor total em estoque

### Fase 4: Extras (opcional, 2–3 dias)

- [ ] Exportação CSV
- [ ] Importação de produtos por planilha
- [ ] Relatórios por período
- [ ] Código de barras

### Fase 5: Qualidade e segurança (1–2 dias)

- [ ] Testes E2E dos fluxos críticos (login, cadastrar produto, entrada e saída)
- [ ] Rate limit, helmet, CORS restrito, validação em todas as rotas
- [ ] Tratamento de erros e logs

### Fase 6: Deploy (1 dia)

- [ ] Projeto `web` na Vercel (root `apps/web`) e projeto `api` (root `apps/api`)
- [ ] Variáveis de ambiente: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `CORS_ORIGIN`, `VITE_API_URL`
- [ ] Migrations do Drizzle rodando no CI (GitHub Actions)
- [ ] Endpoint `/health`, domínio e HTTPS
- [ ] Deploy automático a partir da branch `main`
- [ ] Verificar a política de backup do plano do Turso

**Estimativa do MVP** (fases 0 a 3, 5 e 6): cerca de 2 a 3 semanas em tempo parcial.

## Fluxo de trabalho

- Branch `main` protegida; mudanças por PR a partir de `feature/*`
- Commits no padrão Conventional Commits
- Nunca commitar `.env` ou `*.db`

## Riscos e cuidados

- **Cookies entre domínios:** exigem `SameSite=None; Secure` e CORS com credenciais; subdomínios do mesmo domínio simplificam.
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

### Banco (Turso)

```bash
turso db create estoque
turso db show estoque --url        # TURSO_DATABASE_URL
turso db tokens create estoque     # TURSO_AUTH_TOKEN
```

Em desenvolvimento local, `TURSO_DATABASE_URL=file:local.db` dispensa o Turso.
