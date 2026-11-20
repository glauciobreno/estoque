import { TIPOS_MOVIMENTACAO } from "@estoque/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MovimentacaoForm } from "../components/MovimentacaoForm";
import { ProdutoPicker } from "../components/ProdutoPicker";
import { TabelaMovimentacoes } from "../components/TabelaMovimentacoes";
import {
  Abas,
  Button,
  CabecalhoPagina,
  Campo,
  Carregando,
  Erro,
  Indicador,
  Input,
  Paginacao,
  Painel,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import { dataLocalISO, mesPorExtenso, primeiroDiaDoMes } from "../lib/format";
import type { ContagemMovimentacoes, Movimentacao, Pagina, Produto } from "../lib/types";
import { useFiltrosUrl } from "../lib/useFiltrosUrl";

type Aba = "todas" | (typeof TIPOS_MOVIMENTACAO)[number];

export function Movimentacoes() {
  const { params, mudar } = useFiltrosUrl();
  const [novo, setNovo] = useState(false);
  const [produto, setProduto] = useState<Produto | null>(null);

  const page = Number(params.get("page") ?? 1);
  const aba: Aba = TIPOS_MOVIMENTACAO.find((t) => t === params.get("tipo")) ?? "todas";
  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";

  const mes = useQuery({
    queryKey: ["movimentacoes", "contagem", "mes", primeiroDiaDoMes()],
    queryFn: () =>
      api<ContagemMovimentacoes>("/movimentacoes/contagem", {
        params: { de: primeiroDiaDoMes(), ate: dataLocalISO() },
      }),
  });
  const contagem = useQuery({
    queryKey: ["movimentacoes", "contagem", produto?.id, de, ate],
    queryFn: () =>
      api<ContagemMovimentacoes>("/movimentacoes/contagem", {
        params: { produtoId: produto?.id, de, ate },
      }),
  });
  const lista = useQuery({
    queryKey: ["movimentacoes", "lista", page, aba, de, ate, produto?.id],
    queryFn: () =>
      api<Pagina<Movimentacao>>("/movimentacoes", {
        params: {
          page,
          tipo: aba === "todas" ? undefined : aba,
          de,
          ate,
          produtoId: produto?.id,
          pageSize: 10,
        },
      }),
  });

  const filtrando = Boolean(produto || de || ate);
  const c = contagem.data;

  return (
    <>
      <CabecalhoPagina
        titulo="Movimentações"
        descricao="Cada entrada, saída e ajuste. Tudo em um só lugar."
        acoes={<Button onClick={() => setNovo(true)}>+ Nova movimentação</Button>}
      />

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <Indicador
          rotulo="Entradas no mês"
          tom="sucesso"
          valor={mes.data?.entrada.toLocaleString("pt-BR") ?? "—"}
          apoio={mesPorExtenso()}
        />
        <Indicador
          rotulo="Saídas no mês"
          tom="marca"
          valor={mes.data?.saida.toLocaleString("pt-BR") ?? "—"}
          apoio={mesPorExtenso()}
        />
        <Indicador
          rotulo="Ajustes de inventário"
          tom="cinza"
          valor={mes.data?.ajuste.toLocaleString("pt-BR") ?? "—"}
          apoio={mesPorExtenso()}
        />
      </div>

      <Painel>
        <Abas
          rotulo="Tipo de movimentação"
          ativa={aba}
          onMudar={(id) => mudar({ tipo: id === "todas" ? "" : id })}
          abas={[
            { id: "todas", rotulo: "Todas", contagem: c?.todas },
            { id: "entrada", rotulo: "Entradas", contagem: c?.entrada },
            { id: "saida", rotulo: "Saídas", contagem: c?.saida },
            { id: "ajuste", rotulo: "Ajustes", contagem: c?.ajuste },
          ]}
        />

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
          <Campo rotulo="Produto">
            {(id) => (
              <ProdutoPicker
                id={id}
                valor={produto}
                apenasAtivos={false}
                onChange={(p) => {
                  setProduto(p);
                  mudar({});
                }}
              />
            )}
          </Campo>
          <Campo rotulo="De">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={de}
                onChange={(e) => mudar({ de: e.target.value })}
              />
            )}
          </Campo>
          <Campo rotulo="Até">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={ate}
                onChange={(e) => mudar({ ate: e.target.value })}
              />
            )}
          </Campo>
          {filtrando && (
            <Button
              variante="fantasma"
              onClick={() => {
                setProduto(null);
                mudar({ de: "", ate: "" });
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-5">
            <Erro erro={lista.error} />
          </div>
        ) : lista.data.items.length === 0 ? (
          <Vazio>Nenhuma movimentação encontrada.</Vazio>
        ) : (
          <TabelaMovimentacoes itens={lista.data.items} />
        )}
        {lista.data && (
          <Paginacao
            page={lista.data.page}
            pageSize={lista.data.pageSize}
            total={lista.data.total}
            rotulo="movimentações"
            onMudar={(p) => mudar({ page: String(p) })}
          />
        )}
      </Painel>

      {novo && (
        <MovimentacaoForm onConcluir={() => setNovo(false)} onFechar={() => setNovo(false)} />
      )}
    </>
  );
}
