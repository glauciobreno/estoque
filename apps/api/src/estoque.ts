import type { MovimentacaoInput } from "@estoque/shared";
import { and, eq, gt, gte, lte, sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { fornecedores, movimentacoes, produtos } from "./db/schema.js";
import { HttpError, naoEncontrado } from "./erros.js";

/** Produto com mínimo definido e saldo igual ou abaixo dele. */
export const abaixoDoMinimo = and(
  gt(produtos.estoqueMinimo, 0),
  lte(produtos.saldoAtual, produtos.estoqueMinimo),
);

/** Variação que a movimentação aplica ao saldo (entrada +, saída −, ajuste = novo − atual). */
export function variacaoDoSaldo(mov: MovimentacaoInput, saldoAtual: number): number {
  const variacao =
    mov.tipo === "entrada"
      ? mov.quantidade
      : mov.tipo === "saida"
        ? -mov.quantidade
        : mov.novoSaldo - saldoAtual;

  if (saldoAtual + variacao < 0) {
    throw new HttpError(409, `Saldo insuficiente: disponível ${saldoAtual}`);
  }
  if (variacao === 0) {
    throw new HttpError(422, "A movimentação não altera o saldo");
  }
  return variacao;
}

/**
 * Grava a movimentação e atualiza o saldo na mesma transação (escrita serializada).
 * O UPDATE condicional é uma segunda barreira contra saldo negativo.
 */
export function registrarMovimentacao(db: Db, mov: MovimentacaoInput, usuarioId: number) {
  return db.transaction(async (tx) => {
    const [produto] = await tx.select().from(produtos).where(eq(produtos.id, mov.produtoId));
    if (!produto) throw naoEncontrado("Produto");
    if (!produto.ativo) throw new HttpError(409, "Produto inativo");

    const fornecedorId = mov.tipo === "entrada" ? (mov.fornecedorId ?? null) : null;
    if (fornecedorId !== null) {
      const [existe] = await tx
        .select({ id: fornecedores.id })
        .from(fornecedores)
        .where(eq(fornecedores.id, fornecedorId));
      if (!existe) throw new HttpError(400, "Fornecedor inexistente");
    }

    const variacao = variacaoDoSaldo(mov, produto.saldoAtual);

    const [atualizado] = await tx
      .update(produtos)
      .set({ saldoAtual: sql`${produtos.saldoAtual} + ${variacao}` })
      .where(and(eq(produtos.id, produto.id), gte(sql`${produtos.saldoAtual} + ${variacao}`, 0)))
      .returning({ saldoAtual: produtos.saldoAtual });
    if (!atualizado) throw new HttpError(409, "Saldo insuficiente");

    const [movimentacao] = await tx
      .insert(movimentacoes)
      .values({
        produtoId: produto.id,
        tipo: mov.tipo,
        quantidade: variacao,
        motivo: mov.motivo || null,
        fornecedorId,
        usuarioId,
      })
      .returning();
    return { movimentacao: movimentacao!, saldoAtual: atualizado.saldoAtual };
  });
}
