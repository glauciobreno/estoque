# Sistema de Gerenciamento de Estoque

Sistema web para controle de estoque: cadastro de produtos, categorias e fornecedores, movimentações (entrada, saída e ajuste), alertas de estoque mínimo e dashboard.

## Stack

| Camada | Tecnologia |
|---|---|
| Estrutura | Monorepo (npm workspaces): `apps/web`, `apps/api`, `packages/shared` |
| Frontend | React + Vite + TypeScript, TanStack Query, React Router, React Hook Form + Zod, Tailwind + shadcn/ui |
| Backend | Node 22 + Fastify + TypeScript + Zod |
| Banco | [Turso](https://turso.tech) (libSQL/SQLite) via `@libsql/client` + Drizzle ORM + drizzle-kit |
| Autenticação | JWT em cookie httpOnly + argon2/bcrypt, papéis (admin, operador) |
| Testes | Vitest (unidade e API) + Playwright (E2E) |
| Deploy | Vercel (front e API) + Turso (banco) |

## Modelo de dados inicial

- `usuarios` (id, nome, email, senha_hash, papel)
- `categorias` (id, nome)
- `fornecedores` (id, nome, contato)
- `produtos` (id, sku único, nome, categoria_id, unidade, preço_custo, preço_venda, estoque_minimo, saldo_atual, ativo)
- `movimentacoes` (id, produto_id, tipo [entrada|saída|ajuste], quantidade, motivo, fornecedor_id?, usuario_id, criado_em)

> Toda movimentação é um registro imutável, gravado dentro de uma transação. O saldo nunca fica negativo e nunca diverge do histórico.

## Fases do projeto

### Fase 0: Fundação (1–2 dias)
- [ ] Monorepo, TypeScript, ESLint/Prettier, `.env.example`
- [ ] GitHub Actions com lint, typecheck e testes
- [ ] Criar o banco no Turso (`turso db create`) e gerar o token

### Fase 1: Backend base (2–3 dias)
- [ ] Schema Drizzle e primeira migration
- [ ] API exportando o `app` separado do `listen()` (roda local e como função serverless)
- [ ] Autenticação (login, logout, middleware de papéis)
- [ ] CRUD de categorias, fornecedores e produtos, com paginação, busca e filtros

### Fase 2: Núcleo de estoque (2–3 dias)
- [ ] Endpoint de movimentações transacionais, com bloqueio de saldo negativo
- [ ] Histórico de movimentações por produto
- [ ] Alerta de estoque mínimo
- [ ] Testes unitários da regra de saldo

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

_A ser preenchido na Fase 0._
