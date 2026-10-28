import { z } from "zod";

export const TIPOS_MOVIMENTACAO = ["entrada", "saida", "ajuste"] as const;
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number];

export const PAPEIS = ["admin", "operador"] as const;
export type Papel = (typeof PAPEIS)[number];

const texto = (max: number) => z.string().trim().min(1).max(max);
const inteiroNaoNegativo = z.number().int().min(0);

export const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  senha: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const categoriaSchema = z.object({ nome: texto(100) });
export type CategoriaInput = z.infer<typeof categoriaSchema>;

export const fornecedorSchema = z.object({
  nome: texto(150),
  contato: z.string().trim().max(200).nullish(),
});
export type FornecedorInput = z.infer<typeof fornecedorSchema>;

/** Preços em centavos; o saldo só muda por movimentações (Fase 2). */
export const produtoSchema = z.object({
  sku: texto(50),
  nome: texto(150),
  categoriaId: z.number().int().positive().nullish(),
  unidade: texto(10).default("un"),
  precoCusto: inteiroNaoNegativo.default(0),
  precoVenda: inteiroNaoNegativo.default(0),
  estoqueMinimo: inteiroNaoNegativo.default(0),
  ativo: z.boolean().default(true),
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

const booleanoQuery = z.enum(["true", "false"]).transform((v) => v === "true");

export const listagemSchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const produtoListagemSchema = listagemSchema.extend({
  categoriaId: z.coerce.number().int().positive().optional(),
  ativo: booleanoQuery.optional(),
  abaixoDoMinimo: booleanoQuery.optional(),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const idPositivo = z.number().int().positive();
const quantidadePositiva = z.number().int().positive();

/**
 * Entrada e saída informam a quantidade movimentada; o ajuste informa o saldo contado
 * (novoSaldo) e exige motivo. A quantidade gravada é sempre a variação aplicada ao saldo.
 */
export const movimentacaoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("entrada"),
    produtoId: idPositivo,
    quantidade: quantidadePositiva,
    motivo: z.string().trim().max(300).nullish(),
    fornecedorId: idPositivo.nullish(),
  }),
  z.object({
    tipo: z.literal("saida"),
    produtoId: idPositivo,
    quantidade: quantidadePositiva,
    motivo: z.string().trim().max(300).nullish(),
  }),
  z.object({
    tipo: z.literal("ajuste"),
    produtoId: idPositivo,
    novoSaldo: z.number().int().min(0),
    motivo: texto(300),
  }),
]);
export type MovimentacaoInput = z.infer<typeof movimentacaoSchema>;

const dataQuery = z.iso.date();

export const movimentacaoListagemSchema = listagemSchema.omit({ q: true }).extend({
  produtoId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(TIPOS_MOVIMENTACAO).optional(),
  de: dataQuery.optional(),
  ate: dataQuery.optional(),
});

export type Pagina<T> = { items: T[]; total: number; page: number; pageSize: number };
