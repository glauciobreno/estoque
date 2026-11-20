import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Confirmar } from "../components/Confirmar";
import { FormCadastro, type Registro } from "../components/FormCadastro";
import {
  Button,
  CabecalhoPagina,
  CampoBusca,
  Carregando,
  celula,
  Erro,
  Indicador,
  MenuAcoes,
  Paginacao,
  Painel,
  Tabela,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import { formatDiaMes, mesPorExtenso } from "../lib/format";
import type { EstatisticaFornecedor, Fornecedor, Pagina } from "../lib/types";
import { useFiltrosUrl } from "../lib/useFiltrosUrl";

const campos = [
  { nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 150 },
  { nome: "contato", rotulo: "Contato", maximo: 200 },
];

export function Fornecedores() {
  const { ehAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { params, mudar } = useFiltrosUrl();
  const [editando, setEditando] = useState<Registro | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<Fornecedor | null>(null);

  const page = Number(params.get("page") ?? 1);
  const q = params.get("q") ?? "";

  const lista = useQuery({
    queryKey: ["fornecedores", "lista", page, q],
    queryFn: () => api<Pagina<Fornecedor>>("/fornecedores", { params: { page, q, pageSize: 8 } }),
  });
  const estatisticas = useQuery({
    queryKey: ["fornecedores", "estatisticas"],
    queryFn: () =>
      api<{ items: EstatisticaFornecedor[]; entradasNoMes: number }>("/fornecedores/estatisticas"),
  });
  const porId = new Map(estatisticas.data?.items.map((e) => [e.id, e]));
  const cadastrados = estatisticas.data?.items.length;
  const comEntradas = estatisticas.data?.items.filter((e) => e.entradas > 0).length;

  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["fornecedores"] });

  return (
    <>
      <CabecalhoPagina
        titulo="Fornecedores"
        descricao="Boas parcerias mantêm seu estoque em movimento."
        acoes={ehAdmin && <Button onClick={() => setEditando("novo")}>+ Novo fornecedor</Button>}
      />

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <Indicador
          rotulo="Fornecedores cadastrados"
          valor={cadastrados?.toLocaleString("pt-BR") ?? "—"}
          apoio="Sua rede de parceiros"
        />
        <Indicador
          rotulo="Com entradas registradas"
          valor={comEntradas?.toLocaleString("pt-BR") ?? "—"}
          apoio={
            cadastrados === undefined
              ? undefined
              : `de ${cadastrados.toLocaleString("pt-BR")} cadastrados`
          }
        />
        <Indicador
          rotulo="Entradas no mês"
          valor={estatisticas.data?.entradasNoMes.toLocaleString("pt-BR") ?? "—"}
          apoio={mesPorExtenso()}
        />
      </div>

      <Painel>
        <div className="border-b border-slate-200 px-5 pt-4 pb-4">
          <h2 className="text-[13px] font-semibold text-marca-600">
            Todos os fornecedores{" "}
            {lista.data && (
              <span className="ml-2 text-[12px] font-medium">
                {lista.data.total.toLocaleString("pt-BR")}
              </span>
            )}
          </h2>
        </div>
        <div className="px-5 py-5">
          <CampoBusca
            comIcone
            aria-label="Buscar fornecedores"
            placeholder="Buscar por nome ou contato..."
            className="max-w-xl"
            valor={q}
            onChange={(texto) => mudar({ q: texto })}
          />
        </div>

        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-5">
            <Erro erro={lista.error} />
          </div>
        ) : lista.data.items.length === 0 ? (
          <Vazio>Nenhum fornecedor encontrado.</Vazio>
        ) : (
          <Tabela
            colunas={[
              "Fornecedor",
              "Contato",
              "Produtos",
              "Entradas",
              "Última entrada",
              ...(ehAdmin ? [""] : []),
            ]}
          >
            {lista.data.items.map((f) => {
              const e = porId.get(f.id);
              return (
                <tr key={f.id}>
                  <td className={`${celula} text-[12px] font-medium text-slate-900`}>{f.nome}</td>
                  <td className={`${celula} text-[11px] text-slate-600`}>{f.contato ?? "—"}</td>
                  <td className={`${celula} text-[11px] whitespace-nowrap text-slate-900`}>
                    {e
                      ? `${e.produtos.toLocaleString("pt-BR")} ${e.produtos === 1 ? "produto" : "produtos"}`
                      : "—"}
                  </td>
                  <td className={`${celula} text-[11px] whitespace-nowrap text-slate-900`}>
                    {e
                      ? `${e.entradas.toLocaleString("pt-BR")} (${e.unidades.toLocaleString("pt-BR")} un.)`
                      : "—"}
                  </td>
                  <td className={`${celula} text-[11px] whitespace-nowrap text-slate-900`}>
                    {e?.ultimaEntrada ? formatDiaMes(e.ultimaEntrada) : "—"}
                  </td>
                  {ehAdmin && (
                    <td className={`${celula} text-right`}>
                      <MenuAcoes
                        rotulo={f.nome}
                        itens={[
                          {
                            rotulo: "Editar",
                            onClick: () =>
                              setEditando({ id: f.id, nome: f.nome, contato: f.contato }),
                          },
                          { rotulo: "Excluir", onClick: () => setExcluindo(f), perigo: true },
                        ]}
                      />
                    </td>
                  )}
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
            rotulo="fornecedores"
            onMudar={(p) => mudar({ page: String(p) })}
          />
        )}
      </Painel>

      {editando && (
        <FormCadastro
          singular="fornecedor"
          novo="Novo"
          endpoint="/fornecedores"
          campos={campos}
          registro={editando === "novo" ? undefined : editando}
          onConcluir={() => {
            setEditando(null);
            atualizar();
          }}
          onFechar={() => setEditando(null)}
        />
      )}
      {excluindo && (
        <Confirmar
          titulo="Excluir fornecedor"
          mensagem={`Excluir "${excluindo.nome}"? Esta ação não pode ser desfeita.`}
          acao={() => api(`/fornecedores/${excluindo.id}`, { method: "DELETE" })}
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
