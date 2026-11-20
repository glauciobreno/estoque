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
  Indicador,
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
        params: { page, pageSize: 10 },
      }),
  });

  if (produto.isPending) return <Carregando />;
  if (produto.error) {
    return (
      <>
        <Link
          to="/produtos"
          className="mb-4 inline-block text-[12px] text-marca-600 hover:underline"
        >
          ← Produtos
        </Link>
        <Erro erro={produto.error} />
      </>
    );
  }
  const p = produto.data;

  return (
    <>
      <Link to="/produtos" className="mb-4 inline-block text-[12px] text-marca-600 hover:underline">
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

      <div className="mb-6 grid grid-cols-2 gap-6 lg:grid-cols-5">
        <Indicador
          rotulo="Saldo"
          valor={<SaldoSelo produto={p} />}
          className="[&>p:nth-child(2)]:font-sans [&>p:nth-child(2)]:text-[14px]"
        />
        <Indicador rotulo="Estoque mínimo" valor={p.estoqueMinimo.toLocaleString("pt-BR")} />
        <Indicador rotulo="Preço de custo" valor={formatBRL(p.precoCusto)} />
        <Indicador rotulo="Preço de venda" valor={formatBRL(p.precoVenda)} />
        <Indicador
          rotulo="Situação"
          valor={<Selo tom={p.ativo ? "verde" : "neutro"}>{p.ativo ? "Ativo" : "Inativo"}</Selo>}
          className="[&>p:nth-child(2)]:font-sans [&>p:nth-child(2)]:text-[14px]"
        />
      </div>

      <Painel titulo="Histórico de movimentações">
        <div className="mt-4">
          {historico.isPending ? (
            <Carregando />
          ) : historico.error ? (
            <div className="p-5">
              <Erro erro={historico.error} />
            </div>
          ) : historico.data.items.length === 0 ? (
            <Vazio>Este produto ainda não tem movimentações.</Vazio>
          ) : (
            <TabelaMovimentacoes itens={historico.data.items} mostrarProduto={false} />
          )}
        </div>
        {historico.data && (
          <Paginacao
            page={historico.data.page}
            pageSize={historico.data.pageSize}
            total={historico.data.total}
            rotulo="movimentações"
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
