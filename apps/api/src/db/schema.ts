import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { PAPEIS, TIPOS_MOVIMENTACAO } from "@estoque/shared";

const criadoEm = () =>
  text("criado_em")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

export const usuarios = sqliteTable("usuarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  papel: text("papel", { enum: PAPEIS }).notNull().default("operador"),
  criadoEm: criadoEm(),
});

export const categorias = sqliteTable("categorias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull().unique(),
});

export const fornecedores = sqliteTable("fornecedores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  contato: text("contato"),
});

export const produtos = sqliteTable(
  "produtos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sku: text("sku").notNull().unique(),
    nome: text("nome").notNull(),
    categoriaId: integer("categoria_id").references(() => categorias.id),
    unidade: text("unidade").notNull().default("un"),
    precoCusto: integer("preco_custo").notNull().default(0),
    precoVenda: integer("preco_venda").notNull().default(0),
    estoqueMinimo: integer("estoque_minimo").notNull().default(0),
    saldoAtual: integer("saldo_atual").notNull().default(0),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [index("produtos_categoria_idx").on(t.categoriaId)],
);

export const movimentacoes = sqliteTable(
  "movimentacoes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    produtoId: integer("produto_id")
      .notNull()
      .references(() => produtos.id),
    tipo: text("tipo", { enum: TIPOS_MOVIMENTACAO }).notNull(),
    quantidade: integer("quantidade").notNull(),
    motivo: text("motivo"),
    fornecedorId: integer("fornecedor_id").references(() => fornecedores.id),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [index("movimentacoes_produto_idx").on(t.produtoId)],
);
