import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Confirmar } from "../components/Confirmar";
import { FormCadastro, type Registro } from "../components/FormCadastro";
import { Icone } from "../components/Icone";
import {
  Button,
  CabecalhoPagina,
  CampoBusca,
  Carregando,
  Erro,
  MenuAcoes,
  Select,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import { formatBRLInteiro } from "../lib/format";
import type { EstatisticaCategoria } from "../lib/types";
import { useFiltrosUrl } from "../lib/useFiltrosUrl";

const POR_VEZ = 6;
type Ordem = "produtos" | "nome" | "valor";

const ordenacoes: Record<
  Ordem,
  { rotulo: string; comparar: (a: EstatisticaCategoria, b: EstatisticaCategoria) => number }
> = {
  produtos: {
    rotulo: "Mais produtos",
    comparar: (a, b) => b.totalProdutos - a.totalProdutos || a.nome.localeCompare(b.nome),
  },
  nome: { rotulo: "Nome (A–Z)", comparar: (a, b) => a.nome.localeCompare(b.nome) },
  valor: {
    rotulo: "Maior valor em estoque",
    comparar: (a, b) => b.valorEmEstoque - a.valorEmEstoque || a.nome.localeCompare(b.nome),
  },
};

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="flex items-baseline gap-4 px-6 first:pl-0">
      <span className="font-serif text-[30px] leading-none text-slate-900">
        {valor.toLocaleString("pt-BR")}
      </span>
      <span className="text-[12px] text-slate-500">{rotulo}</span>
    </div>
  );
}

export function Categorias() {
  const { ehAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { params, mudar } = useFiltrosUrl();
  const [mostrando, setMostrando] = useState(POR_VEZ);
  const [editando, setEditando] = useState<Registro | "nova" | null>(null);
  const [excluindo, setExcluindo] = useState<EstatisticaCategoria | null>(null);

  const q = params.get("q") ?? "";
  const ordem: Ordem =
    (["produtos", "nome", "valor"] as const).find((o) => o === params.get("ordem")) ?? "produtos";

  const dados = useQuery({
    queryKey: ["categorias", "estatisticas"],
    queryFn: () =>
      api<{ items: EstatisticaCategoria[]; semCategoria: number }>("/categorias/estatisticas"),
  });

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["categorias"] });
    queryClient.invalidateQueries({ queryKey: ["resumo"] });
  };

  const todas = dados.data?.items ?? [];
  const termo = q.trim().toLowerCase();
  const visiveis = todas
    .filter((c) => c.nome.toLowerCase().includes(termo))
    .sort(ordenacoes[ordem].comparar);
  const organizados = todas.reduce((soma, c) => soma + c.totalProdutos, 0);

  return (
    <>
      <CabecalhoPagina
        titulo="Categorias"
        descricao="Um lugar para cada produto. Mais clareza para o seu estoque."
        acoes={ehAdmin && <Button onClick={() => setEditando("nova")}>+ Nova categoria</Button>}
      />

      <div className="mb-8 flex flex-wrap items-center gap-y-4 divide-slate-300 rounded-lg border border-slate-200 bg-faixa px-6 py-5 sm:divide-x">
        <Numero valor={todas.length} rotulo="categorias no total" />
        <Numero valor={organizados} rotulo="produtos organizados" />
        <Numero valor={dados.data?.semCategoria ?? 0} rotulo="produtos sem categoria" />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[13px] font-semibold text-marca-600">Todas as categorias</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-[312px] max-w-full">
            <CampoBusca
              aria-label="Buscar categoria"
              placeholder="Buscar categoria..."
              valor={q}
              onChange={(texto) => {
                setMostrando(POR_VEZ);
                mudar({ q: texto });
              }}
            />
          </div>
          <Select
            aria-label="Ordenação"
            className="w-[185px]"
            value={ordem}
            onChange={(e) => mudar({ ordem: e.target.value === "produtos" ? "" : e.target.value })}
          >
            {(Object.keys(ordenacoes) as Ordem[]).map((o) => (
              <option key={o} value={o}>
                {ordenacoes[o].rotulo}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {dados.isPending ? (
        <Carregando />
      ) : dados.error ? (
        <Erro erro={dados.error} />
      ) : visiveis.length === 0 ? (
        <Vazio>Nenhuma categoria encontrada.</Vazio>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visiveis.slice(0, mostrando).map((c) => (
            <li
              key={c.id}
              className="flex flex-col rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-[42px] items-center justify-center rounded-lg bg-[#f4f1ea]">
                  <Icone nome="categorias-ativo" />
                </span>
                {ehAdmin && (
                  <MenuAcoes
                    rotulo={c.nome}
                    itens={[
                      { rotulo: "Editar", onClick: () => setEditando({ id: c.id, nome: c.nome }) },
                      { rotulo: "Excluir", onClick: () => setExcluindo(c), perigo: true },
                    ]}
                  />
                )}
              </div>
              <h3 className="mt-5 text-[17px] font-semibold text-slate-900">{c.nome}</h3>
              <p className="mt-2 text-[11px] text-slate-500">
                {c.saldoTotal.toLocaleString("pt-BR")} {c.saldoTotal === 1 ? "unidade" : "unidades"}{" "}
                em estoque
              </p>
              <div className="mt-5 flex items-center justify-between text-[13px] text-slate-900">
                <span className="font-medium">
                  {c.totalProdutos.toLocaleString("pt-BR")}{" "}
                  {c.totalProdutos === 1 ? "produto" : "produtos"}
                </span>
                <span>{formatBRLInteiro(c.valorEmEstoque)}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-linha pt-4 text-[10px]">
                {c.emAlerta > 0 ? (
                  <span className="text-marca-700">
                    ● {c.emAlerta.toLocaleString("pt-BR")}{" "}
                    {c.emAlerta === 1 ? "produto em alerta" : "produtos em alerta"}
                  </span>
                ) : (
                  <span className="text-sucesso">● Estoque saudável</span>
                )}
                <Link
                  to={`/produtos?categoria=${c.id}`}
                  className="text-slate-500 hover:text-marca-600"
                >
                  Ver produtos →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {visiveis.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[11px] text-slate-500">
            Mostrando {Math.min(mostrando, visiveis.length)} de {visiveis.length}{" "}
            {visiveis.length === 1 ? "categoria" : "categorias"}
          </p>
          {mostrando < visiveis.length && (
            <Button
              variante="secundario"
              className="w-[296px] max-w-full"
              onClick={() => setMostrando(mostrando + POR_VEZ)}
            >
              Carregar mais categorias ↓
            </Button>
          )}
        </div>
      )}

      {editando && (
        <FormCadastro
          singular="categoria"
          novo="Nova"
          endpoint="/categorias"
          campos={[{ nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 100 }]}
          registro={editando === "nova" ? undefined : editando}
          onConcluir={() => {
            setEditando(null);
            atualizar();
          }}
          onFechar={() => setEditando(null)}
        />
      )}
      {excluindo && (
        <Confirmar
          titulo="Excluir categoria"
          mensagem={`Excluir "${excluindo.nome}"? Esta ação não pode ser desfeita.`}
          acao={() => api(`/categorias/${excluindo.id}`, { method: "DELETE" })}
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
