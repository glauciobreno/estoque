import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { GraficoFluxo } from "../components/GraficoFluxo";
import { MovimentacaoForm } from "../components/MovimentacaoForm";
import { SeloTipo, corDaQuantidade } from "../components/SeloTipo";
import {
  Button,
  CabecalhoPagina,
  Carregando,
  celulaCompacta,
  Erro,
  Indicador,
  Painel,
  Select,
  Tabela,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import {
  abreviarUnidade,
  formatBRLInteiro,
  formatDataCurta,
  formatPercentual,
  formatQuantidadeMov,
  variacaoPercentual,
} from "../lib/format";
import type { DiaDeFluxo, Movimentacao, Pagina, Produto, ResumoEstoque } from "../lib/types";

const plural = (n: number, singular: string, pluralizado: string) =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : pluralizado}`;

export function Dashboard() {
  const [movimentando, setMovimentando] = useState(false);
  const [diasDoFluxo, setDiasDoFluxo] = useState(7);

  const resumo = useQuery({
    queryKey: ["resumo"],
    queryFn: () => api<ResumoEstoque>("/estoque/resumo"),
  });
  const alertas = useQuery({
    queryKey: ["alertas"],
    queryFn: () => api<Pagina<Produto>>("/estoque/alertas", { params: { pageSize: 3 } }),
  });
  const recentes = useQuery({
    queryKey: ["movimentacoes", "recentes"],
    queryFn: () => api<Pagina<Movimentacao>>("/movimentacoes", { params: { pageSize: 4 } }),
  });
  const fuso = -new Date().getTimezoneOffset();
  const fluxo = useQuery({
    queryKey: ["fluxo", diasDoFluxo, fuso],
    queryFn: () =>
      api<{ dias: DiaDeFluxo[] }>("/estoque/fluxo", { params: { dias: diasDoFluxo, fuso } }),
  });

  const r = resumo.data;
  const variacao = r ? variacaoPercentual(r.movimentacoesNoMes, r.movimentacoesMesAnterior) : null;
  const atualizadoEm = resumo.dataUpdatedAt
    ? new Date(resumo.dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <>
      <CabecalhoPagina
        titulo="Visão geral"
        descricao="Seu estoque em equilíbrio. Seu negócio em movimento."
        acoes={<Button onClick={() => setMovimentando(true)}>+ Nova movimentação</Button>}
      />

      {resumo.error && (
        <div className="mb-4">
          <Erro erro={resumo.error} />
        </div>
      )}
      {atualizadoEm && (
        <p className="mb-5 text-[9px] font-medium tracking-[0.1em] text-slate-500 uppercase">
          Atualizado hoje, às {atualizadoEm}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Valor em estoque"
          valor={r ? formatBRLInteiro(r.valorEmEstoque) : "—"}
          apoio="a preço de custo, produtos ativos"
        />
        <Indicador
          rotulo="Produtos cadastrados"
          valor={r ? r.produtosAtivos.toLocaleString("pt-BR") : "—"}
          apoio={
            r && r.produtosNovosNoMes > 0 ? (
              <>
                <span className="font-medium text-sucesso">
                  + {r.produtosNovosNoMes.toLocaleString("pt-BR")}
                </span>{" "}
                {r.produtosNovosNoMes === 1 ? "novo produto" : "novos produtos"} neste mês
              </>
            ) : (
              "produtos ativos no catálogo"
            )
          }
        />
        <Indicador
          rotulo="Estoque baixo"
          valor={r ? plural(r.abaixoDoMinimo, "produto", "produtos") : "—"}
          apoio={
            r && r.abaixoDoMinimo > 0 ? (
              <>
                <span className="font-medium text-marca-600">Atenção</span> precisam de reposição
              </>
            ) : (
              "todos acima do mínimo"
            )
          }
        />
        <Indicador
          rotulo="Movimentações do mês"
          valor={r ? r.movimentacoesNoMes.toLocaleString("pt-BR") : "—"}
          apoio={
            variacao === null ? (
              "entradas, saídas e ajustes"
            ) : (
              <>
                <span
                  className={
                    variacao >= 0 ? "font-medium text-sucesso" : "font-medium text-marca-600"
                  }
                >
                  {variacao >= 0 ? "↗" : "↘"} {formatPercentual(variacao)}
                </span>{" "}
                em relação ao mês anterior
              </>
            )
          }
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_376px]">
        <Painel
          titulo="Fluxo de estoque"
          descricao={`Entradas e saídas nos últimos ${diasDoFluxo} dias`}
          acao={
            <div className="flex items-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-marca-600" /> Entradas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[#d4cec1]" /> Saídas
              </span>
              <Select
                aria-label="Período do gráfico"
                value={diasDoFluxo}
                onChange={(e) => setDiasDoFluxo(Number(e.target.value))}
                discreto
                className="w-[78px]"
              >
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={30}>30 dias</option>
              </Select>
            </div>
          }
        >
          {fluxo.isPending ? (
            <Carregando />
          ) : fluxo.error ? (
            <div className="p-5">
              <Erro erro={fluxo.error} />
            </div>
          ) : (
            <GraficoFluxo dias={fluxo.data.dias} />
          )}
        </Painel>

        <Painel
          titulo="Atenção ao estoque"
          descricao="Antecipe a reposição e evite rupturas."
          className="border-slate-200 bg-alerta"
          acao={
            alertas.data && (
              <span className="rounded-[5px] bg-marca-100 px-2.5 py-1.5 text-[10px] font-medium text-marca-600">
                {plural(alertas.data.total, "item", "itens")}
              </span>
            )
          }
        >
          <div className="px-5 pt-5 pb-5">
            {alertas.isPending ? (
              <Carregando />
            ) : alertas.error ? (
              <Erro erro={alertas.error} />
            ) : alertas.data.items.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-slate-500">
                Nenhum produto abaixo do mínimo. Estoque em equilíbrio.
              </p>
            ) : (
              <ul className="space-y-5">
                {alertas.data.items.map((p) => {
                  const nivel =
                    p.estoqueMinimo > 0 ? Math.min(1, p.saldoAtual / p.estoqueMinimo) : 0;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          to={`/produtos/${p.id}`}
                          className="block truncate text-[12px] font-medium text-slate-900 hover:underline"
                        >
                          {p.nome}
                        </Link>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {p.saldoAtual.toLocaleString("pt-BR")} de{" "}
                          {p.estoqueMinimo.toLocaleString("pt-BR")} {abreviarUnidade(p.unidade)}{" "}
                          mínimas
                        </p>
                      </div>
                      <div
                        role="img"
                        aria-label={`Nível atual: ${Math.round(nivel * 100)}% do mínimo`}
                        className="h-1 w-20 shrink-0 rounded-sm bg-[#e6dfd3]"
                      >
                        <div
                          className="h-1 rounded-sm bg-marca-600"
                          style={{ width: `${nivel * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to="/produtos?aba=baixo"
              className="mt-8 inline-block text-[11px] font-medium text-marca-600 hover:underline"
            >
              Ver todos os produtos em alerta →
            </Link>
          </div>
        </Painel>
      </div>

      <Painel
        titulo="Movimentações recentes"
        acao={
          <Link
            to="/movimentacoes"
            className="text-[11px] font-medium text-marca-600 hover:underline"
          >
            Ver todas →
          </Link>
        }
      >
        <div className="mt-4">
          {recentes.isPending ? (
            <Carregando />
          ) : recentes.error ? (
            <div className="p-5">
              <Erro erro={recentes.error} />
            </div>
          ) : recentes.data.items.length === 0 ? (
            <Vazio>Nenhuma movimentação registrada.</Vazio>
          ) : (
            <Tabela colunas={["Produto", "Tipo", "Quantidade", "Responsável", "Data", "Status"]}>
              {recentes.data.items.map((m) => (
                <tr key={m.id}>
                  <td className={`${celulaCompacta} text-[11px] font-medium text-slate-900`}>
                    {m.produtoNome}
                  </td>
                  <td className={celulaCompacta}>
                    <SeloTipo tipo={m.tipo} />
                  </td>
                  <td className={`${celulaCompacta} text-[11px] ${corDaQuantidade(m.quantidade)}`}>
                    {formatQuantidadeMov(m.quantidade, m.produtoUnidade)}
                  </td>
                  <td className={`${celulaCompacta} text-[11px] text-slate-900`}>
                    {m.usuarioNome}
                  </td>
                  <td className={`${celulaCompacta} text-[11px] whitespace-nowrap text-slate-900`}>
                    {formatDataCurta(m.criadoEm)}
                  </td>
                  <td className={`${celulaCompacta} text-[10px] whitespace-nowrap text-sucesso`}>
                    ● Concluído
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </div>
      </Painel>

      {movimentando && (
        <MovimentacaoForm
          onConcluir={() => setMovimentando(false)}
          onFechar={() => setMovimentando(false)}
        />
      )}
    </>
  );
}
