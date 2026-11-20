import { PAPEIS, type Papel } from "@estoque/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Confirmar } from "../components/Confirmar";
import { ConviteModal } from "../components/ConviteModal";
import { UsuarioForm } from "../components/UsuarioForm";
import {
  Abas,
  Button,
  CabecalhoPagina,
  CampoBusca,
  Carregando,
  celula,
  Erro,
  MenuAcoes,
  Painel,
  Select,
  Selo,
  Tabela,
  Vazio,
  type ItemMenu,
} from "../components/ui";
import { api } from "../lib/api";
import { formatDataIso } from "../lib/format";
import { nomeDoPapel } from "../lib/papeis";
import type { Convite, UsuarioAdmin } from "../lib/types";

type ConviteAberto = { nome: string; convite: Convite; redefinicao: boolean };
type Aba = "todos" | "pendentes";
type Situacao = "ativo" | "pendente" | "inativo";

const situacaoDe = (u: UsuarioAdmin): Situacao =>
  !u.ativo ? "inativo" : u.pendente ? "pendente" : "ativo";

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="flex items-baseline gap-4 px-8 first:pl-0">
      <span className="font-serif text-[29px] leading-none text-slate-900">
        {valor.toLocaleString("pt-BR")}
      </span>
      <span className="text-[12px] text-slate-500">{rotulo}</span>
    </div>
  );
}

function StatusDoUsuario({ u }: { u: UsuarioAdmin }) {
  const situacao = situacaoDe(u);
  if (situacao === "inativo") return <Selo ponto>Inativo</Selo>;
  if (situacao === "ativo")
    return (
      <Selo tom="verde" ponto>
        Ativo
      </Selo>
    );
  const expirado = !u.conviteExpiraEm || new Date(u.conviteExpiraEm) <= new Date();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Selo tom={expirado ? "vermelho" : "ambar"} ponto>
        Pendente
      </Selo>
      <span className="text-[10px] text-slate-500">
        {expirado ? "Link expirado" : `Link válido até ${formatDataIso(u.conviteExpiraEm!)}`}
      </span>
    </span>
  );
}

const perfis: { papel: Papel; cor: string; descricao: string }[] = [
  {
    papel: "admin",
    cor: "bg-marca-600",
    descricao: "Controle completo do sistema: cadastros, usuários e movimentações.",
  },
  {
    papel: "operador",
    cor: "bg-[#79758d]",
    descricao:
      "Registra movimentações de estoque e consulta o catálogo. Não altera cadastros nem usuários.",
  },
];

export function Usuarios() {
  const { usuario: eu } = useAuth();
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [desativando, setDesativando] = useState<UsuarioAdmin | null>(null);
  const [convite, setConvite] = useState<ConviteAberto | null>(null);
  const [aba, setAba] = useState<Aba>("todos");
  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState<"" | Papel>("");
  const [status, setStatus] = useState<"" | Situacao>("");

  const lista = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => api<{ items: UsuarioAdmin[] }>("/usuarios"),
  });
  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["usuarios"] });

  const reativar = useMutation({
    mutationFn: (u: UsuarioAdmin) =>
      api(`/usuarios/${u.id}`, { method: "PATCH", body: { ativo: true } }),
    onSuccess: atualizar,
  });

  const novoLink = useMutation({
    mutationFn: (u: UsuarioAdmin) =>
      api<{ usuario: UsuarioAdmin; convite: Convite }>(`/usuarios/${u.id}/convite`, {
        method: "POST",
      }),
    onSuccess: ({ usuario, convite }) => {
      atualizar();
      setConvite({ nome: usuario.nome, convite, redefinicao: !usuario.pendente });
    },
  });

  const todos = lista.data?.items ?? [];
  const pendentes = todos.filter((u) => situacaoDe(u) === "pendente").length;
  const ativos = todos.filter((u) => situacaoDe(u) === "ativo").length;
  const termo = busca.trim().toLowerCase();
  const visiveis = todos.filter(
    (u) =>
      (aba === "todos" || situacaoDe(u) === "pendente") &&
      (!perfil || u.papel === perfil) &&
      (!status || situacaoDe(u) === status) &&
      (!termo || u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo)),
  );

  const itensDoMenu = (u: UsuarioAdmin, ehVoce: boolean): ItemMenu[] => [
    { rotulo: "Editar", onClick: () => setEditando(u) },
    ...(u.ativo
      ? [
          {
            rotulo: u.pendente ? "Novo link" : "Redefinir senha",
            onClick: () => novoLink.mutate(u),
          },
        ]
      : []),
    ...(ehVoce
      ? []
      : u.ativo
        ? [{ rotulo: "Desativar", onClick: () => setDesativando(u), perigo: true }]
        : [{ rotulo: "Reativar", onClick: () => reativar.mutate(u) }]),
  ];

  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        descricao="Você cadastra nome e e-mail; a pessoa define a própria senha pelo link de primeiro acesso."
        acoes={<Button onClick={() => setCriando(true)}>+ Novo usuário</Button>}
      />

      {(reativar.error || novoLink.error) && (
        <div className="mb-4">
          <Erro erro={reativar.error ?? novoLink.error} />
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-y-4 divide-slate-300 rounded-lg border border-slate-200 bg-faixa px-6 py-4 sm:divide-x">
        <Numero valor={todos.length} rotulo="usuários na equipe" />
        <Numero valor={ativos} rotulo="acessos ativos" />
        <Numero
          valor={pendentes}
          rotulo={pendentes === 1 ? "convite pendente" : "convites pendentes"}
        />
      </div>

      <Painel>
        <Abas
          rotulo="Visão da equipe"
          ativa={aba}
          onMudar={setAba}
          abas={[
            { id: "todos", rotulo: "Todos os usuários" },
            { id: "pendentes", rotulo: "Convites pendentes", contagem: pendentes },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-5">
          <div className="min-w-[220px] flex-1">
            <CampoBusca
              aria-label="Buscar usuários"
              placeholder="Buscar por nome ou e-mail..."
              valor={busca}
              onChange={setBusca}
              atraso={0}
            />
          </div>
          <Select
            aria-label="Perfil"
            className="w-[220px]"
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as "" | Papel)}
          >
            <option value="">Todos os perfis</option>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {nomeDoPapel(p)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Status"
            className="w-[200px]"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | Situacao)}
          >
            <option value="">Status: todos</option>
            <option value="ativo">Ativo</option>
            <option value="pendente">Pendente</option>
            <option value="inativo">Inativo</option>
          </Select>
        </div>

        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-5">
            <Erro erro={lista.error} />
          </div>
        ) : visiveis.length === 0 ? (
          <Vazio>Nenhum usuário encontrado.</Vazio>
        ) : (
          <Tabela colunas={["Usuário", "Perfil de acesso", "Status", ""]}>
            {visiveis.map((u) => {
              const ehVoce = u.id === eu?.id;
              return (
                <tr key={u.id} className={u.ativo ? undefined : "text-slate-500"}>
                  <td className={celula}>
                    <p className="text-[11px] font-medium text-slate-900">
                      {u.nome}
                      {ehVoce && <span className="ml-2 font-normal text-slate-500">(você)</span>}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{u.email}</p>
                  </td>
                  <td className={celula}>
                    <Selo tom={u.papel === "admin" ? "ambar" : "neutro"}>
                      {nomeDoPapel(u.papel)}
                    </Selo>
                  </td>
                  <td className={celula}>
                    <StatusDoUsuario u={u} />
                  </td>
                  <td className={`${celula} text-right whitespace-nowrap`}>
                    {situacaoDe(u) === "pendente" && (
                      <button
                        type="button"
                        disabled={novoLink.isPending}
                        onClick={() => novoLink.mutate(u)}
                        className="mr-3 text-[10px] text-marca-600 hover:underline disabled:opacity-50"
                      >
                        Reenviar
                      </button>
                    )}
                    <MenuAcoes rotulo={u.nome} itens={itensDoMenu(u, ehVoce)} />
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
        <div className="pb-2" />
      </Painel>

      <h2 className="mt-10 text-[16px] font-semibold text-slate-900">Perfis de acesso</h2>
      <p className="mt-1 mb-5 text-[11px] text-slate-500">
        Permissões claras para uma operação segura.
      </p>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {perfis.map((p) => (
          <div key={p.papel} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <span className={`h-6 w-[3px] rounded-sm ${p.cor}`} />
              <h3 className="text-[13px] font-semibold text-slate-900">{nomeDoPapel(p.papel)}</h3>
            </div>
            <p className="mt-4 text-[11px] leading-[18px] text-slate-500">{p.descricao}</p>
          </div>
        ))}
      </div>

      {criando && (
        <UsuarioForm
          onCriado={({ usuario, convite }) => {
            setCriando(false);
            atualizar();
            setConvite({ nome: usuario.nome, convite, redefinicao: false });
          }}
          onFechar={() => setCriando(false)}
        />
      )}
      {editando && (
        <UsuarioForm
          usuario={editando}
          ehVoce={editando.id === eu?.id}
          onSalvo={() => {
            setEditando(null);
            atualizar();
          }}
          onFechar={() => setEditando(null)}
        />
      )}
      {desativando && (
        <Confirmar
          titulo="Desativar usuário"
          mensagem={`Desativar ${desativando.nome}? A pessoa perde o acesso imediatamente, mas o histórico de movimentações é mantido. Você pode reativar depois.`}
          rotuloConfirmar="Desativar"
          acao={() =>
            api(`/usuarios/${desativando.id}`, { method: "PATCH", body: { ativo: false } })
          }
          onConcluir={() => {
            setDesativando(null);
            atualizar();
          }}
          onFechar={() => setDesativando(null)}
        />
      )}
      {convite && (
        <ConviteModal
          titulo={convite.redefinicao ? "Link para redefinir a senha" : "Link de primeiro acesso"}
          nome={convite.nome}
          token={convite.convite.token}
          expiraEm={convite.convite.expiraEm}
          redefinicao={convite.redefinicao}
          onFechar={() => setConvite(null)}
        />
      )}
    </>
  );
}
