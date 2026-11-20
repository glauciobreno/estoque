import { fluxoSchema } from "@estoque/shared";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db/client.js";
import { categorias, movimentacoes, produtos } from "../db/schema.js";
import { abaixoDoMinimo } from "../estoque.js";

const mesDe = (coluna: typeof produtos.criadoEm | typeof movimentacoes.criadoEm) =>
  sql`strftime('%Y-%m', ${coluna})`;

export const rotasPainel: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.get("/estoque/resumo", { preHandler: app.autenticar }, async () => {
    const [ativos] = await db
      .select({
        produtosAtivos: count(),
        valorEmEstoque: sql<number>`coalesce(sum(${produtos.saldoAtual} * ${produtos.precoCusto}), 0)`,
        abaixoDoMinimo: sql<number>`coalesce(sum(case when ${abaixoDoMinimo} then 1 else 0 end), 0)`,
        semEstoque: sql<number>`coalesce(sum(case when ${produtos.saldoAtual} = 0 then 1 else 0 end), 0)`,
        produtosNovosNoMes: sql<number>`coalesce(sum(case when ${mesDe(produtos.criadoEm)} = strftime('%Y-%m', 'now') then 1 else 0 end), 0)`,
      })
      .from(produtos)
      .where(eq(produtos.ativo, true));
    const [inativos] = await db
      .select({ n: count() })
      .from(produtos)
      .where(eq(produtos.ativo, false));
    const [cats] = await db.select({ n: count() }).from(categorias);
    const [mov] = await db
      .select({
        noMes: sql<number>`coalesce(sum(case when ${mesDe(movimentacoes.criadoEm)} = strftime('%Y-%m', 'now') then 1 else 0 end), 0)`,
        mesAnterior: sql<number>`coalesce(sum(case when ${mesDe(movimentacoes.criadoEm)} = strftime('%Y-%m', 'now', 'start of month', '-1 month') then 1 else 0 end), 0)`,
      })
      .from(movimentacoes);

    return {
      produtosAtivos: ativos?.produtosAtivos ?? 0,
      produtosInativos: inativos?.n ?? 0,
      valorEmEstoque: ativos?.valorEmEstoque ?? 0,
      abaixoDoMinimo: ativos?.abaixoDoMinimo ?? 0,
      semEstoque: ativos?.semEstoque ?? 0,
      categorias: cats?.n ?? 0,
      produtosNovosNoMes: ativos?.produtosNovosNoMes ?? 0,
      movimentacoesNoMes: mov?.noMes ?? 0,
      movimentacoesMesAnterior: mov?.mesAnterior ?? 0,
    };
  });

  // Entradas e saídas por dia nos últimos N dias (inclui hoje), com zeros nos dias sem movimento.
  app.get("/estoque/fluxo", { preHandler: app.autenticar }, async (req) => {
    const { dias, fuso } = fluxoSchema.parse(req.query);
    // `fuso` é um inteiro validado, então é seguro usá-lo como literal; assim o SELECT e o GROUP BY
    // têm exatamente a mesma expressão.
    const modificador = sql.raw(`'${fuso >= 0 ? "+" : "-"}${Math.abs(fuso)} minutes'`);
    const dataLocal = sql<string>`date(${movimentacoes.criadoEm}, ${modificador})`;

    const agoraLocal = Date.now() + fuso * 60_000;
    const diaLocal = (atras: number) =>
      new Date(agoraLocal - atras * 86_400_000).toISOString().slice(0, 10);
    const lista = Array.from({ length: dias }, (_, i) => diaLocal(dias - 1 - i));

    const linhas = await db
      .select({
        data: dataLocal,
        tipo: movimentacoes.tipo,
        total: sql<number>`sum(abs(${movimentacoes.quantidade}))`,
      })
      .from(movimentacoes)
      .where(
        and(inArray(movimentacoes.tipo, ["entrada", "saida"]), sql`${dataLocal} >= ${lista[0]}`),
      )
      .groupBy(dataLocal, movimentacoes.tipo);

    const porDia = new Map(lista.map((data) => [data, { data, entradas: 0, saidas: 0 }]));
    for (const linha of linhas) {
      const dia = porDia.get(linha.data);
      if (!dia) continue;
      if (linha.tipo === "entrada") dia.entradas = linha.total;
      else dia.saidas = linha.total;
    }
    return { dias: [...porDia.values()] };
  });
};
