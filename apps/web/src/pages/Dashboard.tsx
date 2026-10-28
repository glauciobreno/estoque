import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MovimentacaoForm } from "../components/MovimentacaoForm";
import { SeloTipo } from "../components/SeloTipo";
import {
  Button,
  CabecalhoPagina,
  Carregando,
  celula,
  Erro,
  Painel,
  Selo,
  Tabela,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import { formatBRL, formatData, formatQuantidade } from "../lib/format";
import type { Movimentacao, Pagina, Produto, ResumoEstoque } from "../lib/types";

function Indicador({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "alerta" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{rotulo}</p>
      <p
        className={`mt-1 text-2xl font-bold ${tom === "alerta" ? "text-red-600" : "text-slate-900"}`}
      >
        {valor}
      </p>
    </div>
  );
}

export function Dashboard() {
  const [movimentando, setMovimentando] = useState(false);
  const resumo = useQuery({
    queryKey: ["resumo"],
    queryFn: () => api<ResumoEstoque>("/estoque/resumo"),
  });
  const alertas = useQuery({
    queryKey: ["alertas"],
    queryFn: () => api<Pagina<Produto>>("/estoque/alertas", { params: { pageSize: 8 } }),
  });
  const recentes = useQuery({
    queryKey: ["movimentacoes", "recentes"],
    queryFn: () => api<Pagina<Movimentacao>>("/movimentacoes", { params: { pageSize: 8 } }),
  });

  return (
    <>
      <CabecalhoPagina
        titulo="Dashboard"
        descricao="Visão geral do estoque"
        acoes={<Button onClick={() => setMovimentando(true)}>Nova movimentação</Button>}
      />

      {resumo.error && <Erro erro={resumo.error} />}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador
          rotulo="Valor em estoque (custo)"
          valor={resumo.data ? formatBRL(resumo.data.valorEmEstoque) : "—"}
        />
        <Indicador
          rotulo="Produtos ativos"
          valor={resumo.data ? String(resumo.data.produtosAtivos) : "—"}
        />
        <Indicador
          rotulo="Abaixo do mínimo"
          valor={resumo.data ? String(resumo.data.abaixoDoMinimo) : "—"}
          tom={resumo.data && resumo.data.abaixoDoMinimo > 0 ? "alerta" : undefined}
        />
        <Indicador
          rotulo="Sem estoque"
          valor={resumo.data ? String(resumo.data.semEstoque) : "—"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Painel
          titulo="Estoque baixo"
          acao={
            <Link to="/produtos?abaixo=true" className="text-sm text-marca-600 hover:underline">
              Ver todos
            </Link>
          }
        >
          {alertas.isPending ? (
            <Carregando />
          ) : alertas.error ? (
            <div className="p-4">
              <Erro erro={alertas.error} />
            </div>
          ) : alertas.data.items.length === 0 ? (
            <Vazio>Nenhum produto abaixo do mínimo.</Vazio>
          ) : (
            <Tabela colunas={["Produto", "Saldo", "Mínimo"]}>
              {alertas.data.items.map((p) => (
                <tr key={p.id}>
                  <td className={celula}>
                    <Link
                      to={`/produtos/${p.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {p.nome}
                    </Link>
                    <span className="ml-2 text-xs text-slate-500">{p.sku}</span>
                  </td>
                  <td className={celula}>
                    <Selo tom={p.saldoAtual === 0 ? "vermelho" : "ambar"}>{p.saldoAtual}</Selo>
                  </td>
                  <td className={celula}>{p.estoqueMinimo}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Painel>

        <Painel
          titulo="Últimas movimentações"
          acao={
            <Link to="/movimentacoes" className="text-sm text-marca-600 hover:underline">
              Ver todas
            </Link>
          }
        >
          {recentes.isPending ? (
            <Carregando />
          ) : recentes.error ? (
            <div className="p-4">
              <Erro erro={recentes.error} />
            </div>
          ) : recentes.data.items.length === 0 ? (
            <Vazio>Nenhuma movimentação registrada.</Vazio>
          ) : (
            <Tabela colunas={["Quando", "Produto", "Tipo", "Qtd."]}>
              {recentes.data.items.map((m) => (
                <tr key={m.id}>
                  <td className={`${celula} whitespace-nowrap text-slate-500`}>
                    {formatData(m.criadoEm)}
                  </td>
                  <td className={celula}>{m.produtoNome}</td>
                  <td className={celula}>
                    <SeloTipo tipo={m.tipo} />
                  </td>
                  <td className={`${celula} font-medium`}>{formatQuantidade(m.quantidade)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Painel>
      </div>

      {movimentando && (
        <MovimentacaoForm
          onConcluir={() => setMovimentando(false)}
          onFechar={() => setMovimentando(false)}
        />
      )}
    </>
  );
}
