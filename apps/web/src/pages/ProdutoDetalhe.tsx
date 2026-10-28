import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { MovimentacaoForm } from "../components/MovimentacaoForm";
import { ProdutoForm } from "../components/ProdutoForm";
import { TabelaMovimentacoes } from "../components/TabelaMovimentacoes";
import {
  Button,
  CabecalhoPagina,
  Carregando,
  Erro,
  Paginacao,
  Painel,
  Selo,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import { formatBRL } from "../lib/format";
import type { Movimentacao, Pagina, Produto } from "../lib/types";
import { SaldoSelo } from "./Produtos";

export function ProdutoDetalhe() {
  const { id } = useParams();
  const { ehAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const [editando, setEditando] = useState(false);
  const [movimentando, setMovimentando] = useState(false);

  const produto = useQuery({
    queryKey: ["produtos", id],
    queryFn: () => api<Produto>(`/produtos/${id}`),
  });
  const historico = useQuery({
    queryKey: ["movimentacoes", "produto", id, page],
    queryFn: () =>
      api<Pagina<Movimentacao>>(`/produtos/${id}/movimentacoes`, {
        params: { page, pageSize: 15 },
      }),
  });

  if (produto.isPending) return <Carregando />;
  if (produto.error) {
    return (
      <>
        <Link to="/produtos" className="mb-4 inline-block text-sm text-marca-600 hover:underline">
          ← Produtos
        </Link>
        <Erro erro={produto.error} />
      </>
    );
  }
  const p = produto.data;

  return (
    <>
      <Link to="/produtos" className="mb-3 inline-block text-sm text-marca-600 hover:underline">
        ← Produtos
      </Link>
      <CabecalhoPagina
        titulo={p.nome}
        descricao={`SKU ${p.sku}`}
        acoes={
          <>
            {p.ativo && <Button onClick={() => setMovimentando(true)}>Movimentar</Button>}
            {ehAdmin && (
              <Button variante="secundario" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Info rotulo="Saldo">
          <SaldoSelo produto={p} />
        </Info>
        <Info rotulo="Estoque mínimo">{p.estoqueMinimo}</Info>
        <Info rotulo="Preço de custo">{formatBRL(p.precoCusto)}</Info>
        <Info rotulo="Preço de venda">{formatBRL(p.precoVenda)}</Info>
        <Info rotulo="Situação">
          <Selo tom={p.ativo ? "verde" : "neutro"}>{p.ativo ? "Ativo" : "Inativo"}</Selo>
        </Info>
      </div>

      <Painel titulo="Histórico de movimentações">
        {historico.isPending ? (
          <Carregando />
        ) : historico.error ? (
          <div className="p-4">
            <Erro erro={historico.error} />
          </div>
        ) : historico.data.items.length === 0 ? (
          <Vazio>Este produto ainda não tem movimentações.</Vazio>
        ) : (
          <TabelaMovimentacoes itens={historico.data.items} mostrarProduto={false} />
        )}
        {historico.data && (
          <Paginacao
            page={historico.data.page}
            pageSize={historico.data.pageSize}
            total={historico.data.total}
            onMudar={(n) => setParams({ page: String(n) }, { replace: true })}
          />
        )}
      </Painel>

      {editando && (
        <ProdutoForm
          produto={p}
          onConcluir={() => setEditando(false)}
          onFechar={() => setEditando(false)}
        />
      )}
      {movimentando && (
        <MovimentacaoForm
          produto={p}
          onConcluir={() => setMovimentando(false)}
          onFechar={() => setMovimentando(false)}
        />
      )}
    </>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{rotulo}</p>
      <div className="mt-1 text-lg font-semibold text-slate-900">{children}</div>
    </div>
  );
}
