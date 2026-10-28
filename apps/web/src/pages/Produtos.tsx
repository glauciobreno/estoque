import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useFiltrosUrl } from "../lib/useFiltrosUrl";
import { useAuth } from "../auth/AuthContext";
import { Confirmar } from "../components/Confirmar";
import { MovimentacaoForm } from "../components/MovimentacaoForm";
import { ProdutoForm } from "../components/ProdutoForm";
import {
  Button,
  CabecalhoPagina,
  Carregando,
  celula,
  Erro,
  CampoBusca,
  Paginacao,
  Painel,
  Select,
  Selo,
  Tabela,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import { formatBRL } from "../lib/format";
import type { Categoria, Pagina, Produto } from "../lib/types";

export function SaldoSelo({ produto }: { produto: Produto }) {
  const baixo = produto.estoqueMinimo > 0 && produto.saldoAtual <= produto.estoqueMinimo;
  return (
    <Selo tom={produto.saldoAtual === 0 ? "vermelho" : baixo ? "ambar" : "verde"}>
      {produto.saldoAtual} {produto.unidade}
    </Selo>
  );
}

export function Produtos() {
  const { ehAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { params, mudar } = useFiltrosUrl();
  const [editando, setEditando] = useState<Produto | "novo" | null>(null);
  const [movimentando, setMovimentando] = useState<Produto | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<Produto | null>(null);

  const page = Number(params.get("page") ?? 1);
  const q = params.get("q") ?? "";
  const categoriaId = params.get("categoria") ?? "";
  const status = params.get("status") ?? "ativos";
  const abaixo = params.get("abaixo") === "true";

  const categorias = useQuery({
    queryKey: ["categorias", "todas"],
    queryFn: () => api<Pagina<Categoria>>("/categorias", { params: { pageSize: 100 } }),
  });
  const nomeCategoria = new Map(categorias.data?.items.map((c) => [c.id, c.nome]));

  const lista = useQuery({
    queryKey: ["produtos", "lista", page, q, categoriaId, status, abaixo],
    queryFn: () =>
      api<Pagina<Produto>>("/produtos", {
        params: {
          page,
          q,
          categoriaId,
          ativo: status === "todos" ? undefined : status === "ativos",
          abaixoDoMinimo: abaixo || undefined,
          pageSize: 15,
        },
      }),
  });

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["produtos"] });
    queryClient.invalidateQueries({ queryKey: ["resumo"] });
    queryClient.invalidateQueries({ queryKey: ["alertas"] });
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Produtos"
        acoes={
          <>
            <Button variante="secundario" onClick={() => setMovimentando("novo")}>
              Nova movimentação
            </Button>
            {ehAdmin && <Button onClick={() => setEditando("novo")}>Novo produto</Button>}
          </>
        }
      />
      <Painel>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <CampoBusca
            aria-label="Buscar produtos"
            placeholder="Buscar por nome ou SKU"
            className="max-w-xs"
            valor={q}
            onChange={(texto) => mudar({ q: texto })}
          />
          <Select
            aria-label="Categoria"
            className="max-w-48"
            value={categoriaId}
            onChange={(e) => mudar({ categoria: e.target.value })}
          >
            <option value="">Todas as categorias</option>
            {categorias.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Situação"
            className="max-w-40"
            value={status}
            onChange={(e) => mudar({ status: e.target.value === "ativos" ? "" : e.target.value })}
          >
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="size-4 rounded"
              checked={abaixo}
              onChange={(e) => mudar({ abaixo: e.target.checked ? "true" : "" })}
            />
            Abaixo do mínimo
          </label>
        </div>

        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-4">
            <Erro erro={lista.error} />
          </div>
        ) : lista.data.items.length === 0 ? (
          <Vazio>Nenhum produto encontrado.</Vazio>
        ) : (
          <Tabela
            colunas={["SKU", "Produto", "Categoria", "Saldo", "Mínimo", "Preço de venda", "Ações"]}
          >
            {lista.data.items.map((p) => (
              <tr key={p.id} className={p.ativo ? undefined : "bg-slate-50 text-slate-500"}>
                <td className={`${celula} whitespace-nowrap font-mono text-xs`}>{p.sku}</td>
                <td className={celula}>
                  <Link
                    to={`/produtos/${p.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {p.nome}
                  </Link>
                  {!p.ativo && (
                    <span className="ml-2">
                      <Selo>Inativo</Selo>
                    </span>
                  )}
                </td>
                <td className={celula}>
                  {p.categoriaId ? (nomeCategoria.get(p.categoriaId) ?? "—") : "—"}
                </td>
                <td className={celula}>
                  <SaldoSelo produto={p} />
                </td>
                <td className={celula}>{p.estoqueMinimo}</td>
                <td className={celula}>{formatBRL(p.precoVenda)}</td>
                <td className={`${celula} space-x-1 whitespace-nowrap`}>
                  {p.ativo && (
                    <Button variante="secundario" pequeno onClick={() => setMovimentando(p)}>
                      Movimentar
                    </Button>
                  )}
                  {ehAdmin && (
                    <>
                      <Button variante="fantasma" pequeno onClick={() => setEditando(p)}>
                        Editar
                      </Button>
                      <Button variante="fantasma" pequeno onClick={() => setExcluindo(p)}>
                        Excluir
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
        {lista.data && (
          <Paginacao
            page={lista.data.page}
            pageSize={lista.data.pageSize}
            total={lista.data.total}
            onMudar={(p) => mudar({ page: String(p) })}
          />
        )}
      </Painel>

      {editando && (
        <ProdutoForm
          produto={editando === "novo" ? undefined : editando}
          onConcluir={() => setEditando(null)}
          onFechar={() => setEditando(null)}
        />
      )}
      {movimentando && (
        <MovimentacaoForm
          produto={movimentando === "novo" ? null : movimentando}
          onConcluir={() => setMovimentando(null)}
          onFechar={() => setMovimentando(null)}
        />
      )}
      {excluindo && (
        <Confirmar
          titulo="Excluir produto"
          mensagem={`Excluir "${excluindo.nome}"? Produtos com movimentações não podem ser excluídos; inative-os.`}
          acao={() => api(`/produtos/${excluindo.id}`, { method: "DELETE" })}
          onConcluir={() => {
            setExcluindo(null);
            atualizar();
          }}
          onFechar={() => setExcluindo(null)}
        />
      )}
    </>
  );
}
