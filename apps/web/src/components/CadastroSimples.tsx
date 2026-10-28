import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useFiltrosUrl } from "../lib/useFiltrosUrl";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { Pagina } from "../lib/types";
import { Confirmar } from "./Confirmar";
import {
  Button,
  CabecalhoPagina,
  Campo,
  Carregando,
  celula,
  Erro,
  CampoBusca,
  Input,
  Modal,
  Paginacao,
  Painel,
  Tabela,
  Vazio,
} from "./ui";

type CampoCadastro = { nome: string; rotulo: string; obrigatorio?: boolean; maximo: number };
type Registro = { id: number } & Record<string, unknown>;

export function CadastroSimples({
  titulo,
  singular,
  feminino,
  endpoint,
  campos,
}: {
  titulo: string;
  singular: string;
  feminino?: boolean;
  endpoint: string;
  campos: CampoCadastro[];
}) {
  const { ehAdmin } = useAuth();
  const { params, mudar } = useFiltrosUrl();
  const page = Number(params.get("page") ?? 1);
  const q = params.get("q") ?? "";
  const [editando, setEditando] = useState<Registro | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<Registro | null>(null);
  const queryClient = useQueryClient();
  const novo = feminino ? "Nova" : "Novo";

  const lista = useQuery({
    queryKey: [endpoint.slice(1), "lista", page, q],
    queryFn: () => api<Pagina<Registro>>(endpoint, { params: { page, q, pageSize: 15 } }),
  });

  const atualizar = () => queryClient.invalidateQueries({ queryKey: [endpoint.slice(1)] });

  return (
    <>
      <CabecalhoPagina
        titulo={titulo}
        acoes={
          ehAdmin && (
            <Button onClick={() => setEditando("novo")}>
              {novo} {singular}
            </Button>
          )
        }
      />
      <Painel>
        <div className="border-b border-slate-100 p-4">
          <CampoBusca
            aria-label={`Buscar ${titulo.toLowerCase()}`}
            placeholder="Buscar"
            className="max-w-sm"
            valor={q}
            onChange={(texto) => mudar({ q: texto })}
          />
        </div>
        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-4">
            <Erro erro={lista.error} />
          </div>
        ) : lista.data.items.length === 0 ? (
          <Vazio>Nenhum registro encontrado.</Vazio>
        ) : (
          <Tabela colunas={[...campos.map((c) => c.rotulo), ...(ehAdmin ? ["Ações"] : [])]}>
            {lista.data.items.map((item) => (
              <tr key={item.id}>
                {campos.map((c) => (
                  <td key={c.nome} className={celula}>
                    {String(item[c.nome] ?? "—")}
                  </td>
                ))}
                {ehAdmin && (
                  <td className={`${celula} space-x-1 whitespace-nowrap`}>
                    <Button variante="secundario" pequeno onClick={() => setEditando(item)}>
                      Editar
                    </Button>
                    <Button variante="fantasma" pequeno onClick={() => setExcluindo(item)}>
                      Excluir
                    </Button>
                  </td>
                )}
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
        <FormCadastro
          singular={singular}
          novo={novo}
          endpoint={endpoint}
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
          titulo={`Excluir ${singular}`}
          mensagem={`Excluir "${String(excluindo[campos[0]!.nome])}"? Esta ação não pode ser desfeita.`}
          acao={() => api(`${endpoint}/${excluindo.id}`, { method: "DELETE" })}
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

function FormCadastro({
  singular,
  novo,
  endpoint,
  campos,
  registro,
  onConcluir,
  onFechar,
}: {
  singular: string;
  novo: string;
  endpoint: string;
  campos: CampoCadastro[];
  registro?: Registro;
  onConcluir: () => void;
  onFechar: () => void;
}) {
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      campos.map((c) => [c.nome, String(registro?.[c.nome] ?? "")]),
    ),
  });

  const mutacao = useMutation({
    mutationFn: (valores: Record<string, string>) => {
      const corpo = Object.fromEntries(
        campos.map((c) => [c.nome, valores[c.nome]?.trim() || (c.obrigatorio ? "" : null)]),
      );
      return registro
        ? api(`${endpoint}/${registro.id}`, { method: "PUT", body: corpo })
        : api(endpoint, { method: "POST", body: corpo });
    },
    onSuccess: onConcluir,
  });

  return (
    <Modal titulo={registro ? `Editar ${singular}` : `${novo} ${singular}`} onFechar={onFechar}>
      <form onSubmit={handleSubmit((v) => mutacao.mutate(v))} className="space-y-4">
        {campos.map((c) => (
          <Campo key={c.nome} rotulo={c.rotulo}>
            {(id) => (
              <Input id={id} maxLength={c.maximo} required={c.obrigatorio} {...register(c.nome)} />
            )}
          </Campo>
        ))}
        {mutacao.error && <Erro erro={mutacao.error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutacao.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
