import { SITUACOES_ESTOQUE } from "@estoque/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Confirmar } from "../components/Confirmar";
import { MovimentacaoForm } from "../components/MovimentacaoForm";
import { ProdutoForm } from "../components/ProdutoForm";
import {
  Abas,
  Button,
  CabecalhoPagina,
  CampoBusca,
  Carregando,
  celula,
  Erro,
  MenuAcoes,
  Paginacao,
  Painel,
  Select,
  Selo,
  Tabela,
  Vazio,
  type ItemMenu,
} from "../components/ui";
import { api } from "../lib/api";
import { abreviarUnidade, formatBRL } from "../lib/format";
import type { Categoria, Pagina, Produto, ResumoEstoque } from "../lib/types";
import { useFiltrosUrl } from "../lib/useFiltrosUrl";

type Aba = "todos" | "baixo" | "inativos";
type Situacao = (typeof SITUACOES_ESTOQUE)[number];

const rotulosDeSituacao: Record<Situacao, string> = {
  saudavel: "Em estoque",
  baixo: "Estoque baixo",
  sem: "Sem estoque",
};

/** Situação de um produto para o chip de status e para a cor do saldo. */
export function situacaoDoProduto(p: Produto): {
  tom: "verde" | "vermelho" | "neutro";
  rotulo: string;
  alerta: boolean;
} {
  if (!p.ativo) return { tom: "neutro", rotulo: "Inativo", alerta: false };
  if (p.saldoAtual === 0) return { tom: "vermelho", rotulo: "Sem estoque", alerta: true };
  if (p.estoqueMinimo > 0 && p.saldoAtual <= p.estoqueMinimo)
    return { tom: "vermelho", rotulo: "Estoque baixo", alerta: true };
  return { tom: "verde", rotulo: "Em estoque", alerta: false };
}

export function SaldoSelo({ produto }: { produto: Produto }) {
  const { tom, alerta } = situacaoDoProduto(produto);
  return (
    <Selo tom={alerta ? tom : "verde"}>
      {produto.saldoAtual.toLocaleString("pt-BR")} {produto.unidade}
    </Selo>
  );
}

function Mini({
  valor,
  rotulo,
  destaque,
}: {
  valor: number | string;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 rounded-lg border border-slate-200 bg-white px-5 py-5">
      <span
        className={`font-serif text-[26px] leading-none ${destaque ? "text-marca-600" : "text-slate-900"}`}
      >
        {typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
      </span>
      <span className="text-[11px] text-slate-500">{rotulo}</span>
    </div>
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
  const abaUrl = params.get("aba");
  const aba: Aba =
    abaUrl === "baixo" || params.get("abaixo") === "true"
      ? "baixo"
      : abaUrl === "inativos"
        ? "inativos"
        : "todos";
  const situacaoUrl = params.get("situacao");
  const situacao = SITUACOES_ESTOQUE.find((s) => s === situacaoUrl) ?? "";

  const resumo = useQuery({
    queryKey: ["resumo"],
    queryFn: () => api<ResumoEstoque>("/estoque/resumo"),
  });
  const categorias = useQuery({
    queryKey: ["categorias", "todas"],
    queryFn: () => api<Pagina<Categoria>>("/categorias", { params: { pageSize: 100 } }),
  });
  const nomeCategoria = new Map(categorias.data?.items.map((c) => [c.id, c.nome]));

  const lista = useQuery({
    queryKey: ["produtos", "lista", page, q, categoriaId, aba, situacao],
    queryFn: () =>
      api<Pagina<Produto>>("/produtos", {
        params: {
          page,
          q,
          categoriaId,
          ativo: aba === "inativos" ? false : aba === "baixo" ? true : undefined,
          situacao: aba === "baixo" ? "baixo" : aba === "todos" ? situacao : undefined,
          pageSize: 10,
        },
      }),
  });

  const r = resumo.data;
  const cadastrados = r ? r.produtosAtivos + r.produtosInativos : undefined;

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["produtos"] });
    queryClient.invalidateQueries({ queryKey: ["resumo"] });
    queryClient.invalidateQueries({ queryKey: ["alertas"] });
  };

  const itensDoMenu = (p: Produto): ItemMenu[] => [
    ...(p.ativo ? [{ rotulo: "Movimentar", onClick: () => setMovimentando(p) }] : []),
    ...(ehAdmin
      ? [
          { rotulo: "Editar", onClick: () => setEditando(p) },
          { rotulo: "Excluir", onClick: () => setExcluindo(p), perigo: true },
        ]
      : []),
  ];

  return (
    <>
      <CabecalhoPagina
        titulo="Produtos"
        descricao="Organize seu catálogo e acompanhe cada item do estoque."
        acoes={
          <>
            <Button variante="secundario" onClick={() => setMovimentando("novo")}>
              Nova movimentação
            </Button>
            {ehAdmin && <Button onClick={() => setEditando("novo")}>+ Novo produto</Button>}
          </>
        }
      />

      <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Mini valor={cadastrados ?? "—"} rotulo="produtos cadastrados" />
        <Mini valor={r ? r.produtosAtivos - r.abaixoDoMinimo : "—"} rotulo="com estoque saudável" />
        <Mini valor={r?.abaixoDoMinimo ?? "—"} rotulo="abaixo do mínimo" destaque />
        <Mini valor={r?.categorias ?? "—"} rotulo="categorias" />
      </div>

      <Painel>
        <Abas
          rotulo="Situação do cadastro"
          ativa={aba}
          onMudar={(id) => mudar({ aba: id === "todos" ? "" : id, situacao: "" })}
          abas={[
            { id: "todos", rotulo: "Todos os produtos", contagem: cadastrados },
            { id: "baixo", rotulo: "Estoque baixo", contagem: r?.abaixoDoMinimo },
            { id: "inativos", rotulo: "Inativos", contagem: r?.produtosInativos },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3 px-5 py-5">
          <div className="min-w-[220px] flex-1">
            <CampoBusca
              comIcone
              aria-label="Buscar produtos"
              placeholder="Buscar por nome ou SKU..."
              valor={q}
              onChange={(texto) => mudar({ q: texto })}
            />
          </div>
          <Select
            aria-label="Categoria"
            className="w-[218px]"
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
          {aba === "todos" && (
            <Select
              aria-label="Status do estoque"
              className="w-[210px]"
              value={situacao}
              onChange={(e) => mudar({ situacao: e.target.value })}
            >
              <option value="">Status do estoque</option>
              {SITUACOES_ESTOQUE.map((s) => (
                <option key={s} value={s}>
                  {rotulosDeSituacao[s]}
                </option>
              ))}
            </Select>
          )}
        </div>

        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-5">
            <Erro erro={lista.error} />
          </div>
        ) : lista.data.items.length === 0 ? (
          <Vazio>Nenhum produto encontrado.</Vazio>
        ) : (
          <Tabela colunas={["Produto", "Categoria", "Estoque", "Preço unit.", "Status", ""]}>
            {lista.data.items.map((p) => {
              const status = situacaoDoProduto(p);
              return (
                <tr key={p.id} className={p.ativo ? undefined : "text-slate-500"}>
                  <td className={celula}>
                    <Link
                      to={`/produtos/${p.id}`}
                      className="block text-[12px] font-medium text-slate-900 hover:underline"
                    >
                      {p.nome}
                    </Link>
                    <span className="text-[10px] text-slate-500">{p.sku}</span>
                  </td>
                  <td className={`${celula} text-[11px] text-slate-600`}>
                    {p.categoriaId ? (nomeCategoria.get(p.categoriaId) ?? "—") : "—"}
                  </td>
                  <td
                    className={`${celula} text-[12px] font-medium whitespace-nowrap ${status.alerta ? "text-marca-700" : "text-slate-900"}`}
                  >
                    {p.saldoAtual.toLocaleString("pt-BR")} {abreviarUnidade(p.unidade)}
                  </td>
                  <td className={`${celula} text-[12px] whitespace-nowrap text-slate-900`}>
                    {formatBRL(p.precoVenda)}
                  </td>
                  <td className={celula}>
                    <Selo tom={status.tom} ponto>
                      {status.rotulo}
                    </Selo>
                  </td>
                  <td className={`${celula} text-right`}>
                    <MenuAcoes rotulo={p.nome} itens={itensDoMenu(p)} />
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
        {lista.data && (
          <Paginacao
            page={lista.data.page}
            pageSize={lista.data.pageSize}
            total={lista.data.total}
            rotulo="produtos"
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
