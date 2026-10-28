import { TIPOS_MOVIMENTACAO } from "@estoque/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useFiltrosUrl } from "../lib/useFiltrosUrl";
import { MovimentacaoForm } from "../components/MovimentacaoForm";
import { ProdutoPicker } from "../components/ProdutoPicker";
import { TabelaMovimentacoes } from "../components/TabelaMovimentacoes";
import {
  Button,
  CabecalhoPagina,
  Campo,
  Carregando,
  Erro,
  Input,
  Paginacao,
  Painel,
  Select,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import type { Movimentacao, Pagina, Produto } from "../lib/types";

const rotulos = { entrada: "Entradas", saida: "Saídas", ajuste: "Ajustes" };

export function Movimentacoes() {
  const { params, mudar } = useFiltrosUrl();
  const [novo, setNovo] = useState(false);
  const [produto, setProduto] = useState<Produto | null>(null);
  const page = Number(params.get("page") ?? 1);
  const tipo = params.get("tipo") ?? "";
  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";

  const lista = useQuery({
    queryKey: ["movimentacoes", "lista", page, tipo, de, ate, produto?.id],
    queryFn: () =>
      api<Pagina<Movimentacao>>("/movimentacoes", {
        params: { page, tipo, de, ate, produtoId: produto?.id, pageSize: 20 },
      }),
  });

  return (
    <>
      <CabecalhoPagina
        titulo="Movimentações"
        descricao="Histórico imutável de entradas, saídas e ajustes"
        acoes={<Button onClick={() => setNovo(true)}>Nova movimentação</Button>}
      />
      <Painel>
        <div className="grid gap-4 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Campo rotulo="Tipo">
            {(id) => (
              <Select id={id} value={tipo} onChange={(e) => mudar({ tipo: e.target.value })}>
                <option value="">Todos</option>
                {TIPOS_MOVIMENTACAO.map((t) => (
                  <option key={t} value={t}>
                    {rotulos[t]}
                  </option>
                ))}
              </Select>
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
        </div>

        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-4">
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
