import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Confirmar } from "../components/Confirmar";
import { ConviteModal } from "../components/ConviteModal";
import { nomeDoPapel, UsuarioForm } from "../components/UsuarioForm";
import {
  Button,
  CabecalhoPagina,
  Carregando,
  celula,
  Erro,
  Painel,
  Selo,
  Tabela,
  Vazio,
} from "../components/ui";
import { api } from "../lib/api";
import { formatDataIso } from "../lib/format";
import type { Convite, UsuarioAdmin } from "../lib/types";

type ConviteAberto = { nome: string; convite: Convite; redefinicao: boolean };

function Situacao({ u }: { u: UsuarioAdmin }) {
  if (!u.ativo) return <Selo>Inativo</Selo>;
  if (!u.pendente) return <Selo tom="verde">Ativo</Selo>;
  const expirado = !u.conviteExpiraEm || new Date(u.conviteExpiraEm) <= new Date();
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Selo tom={expirado ? "vermelho" : "ambar"}>Aguardando primeiro acesso</Selo>
      <span className="text-xs text-slate-500">
        {expirado ? "Link expirado" : `Link válido até ${formatDataIso(u.conviteExpiraEm!)}`}
      </span>
    </span>
  );
}

export function Usuarios() {
  const { usuario: eu } = useAuth();
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [desativando, setDesativando] = useState<UsuarioAdmin | null>(null);
  const [convite, setConvite] = useState<ConviteAberto | null>(null);

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

  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        descricao="Você cadastra nome e e-mail; a pessoa define a própria senha pelo link de primeiro acesso."
        acoes={<Button onClick={() => setCriando(true)}>Novo usuário</Button>}
      />
      {(reativar.error || novoLink.error) && (
        <div className="mb-4">
          <Erro erro={reativar.error ?? novoLink.error} />
        </div>
      )}
      <Painel>
        {lista.isPending ? (
          <Carregando />
        ) : lista.error ? (
          <div className="p-4">
            <Erro erro={lista.error} />
          </div>
        ) : lista.data.items.length === 0 ? (
          <Vazio>Nenhum usuário.</Vazio>
        ) : (
          <Tabela colunas={["Nome", "E-mail", "Papel", "Situação", "Ações"]}>
            {lista.data.items.map((u) => {
              const ehVoce = u.id === eu?.id;
              return (
                <tr key={u.id} className={u.ativo ? undefined : "bg-slate-50 text-slate-500"}>
                  <td className={celula}>
                    <span className="font-medium text-slate-900">{u.nome}</span>
                    {ehVoce && <span className="ml-2 text-xs text-slate-500">(você)</span>}
                  </td>
                  <td className={celula}>{u.email}</td>
                  <td className={celula}>{nomeDoPapel(u.papel)}</td>
                  <td className={celula}>
                    <Situacao u={u} />
                  </td>
                  <td className={`${celula} space-x-1 whitespace-nowrap`}>
                    <Button variante="secundario" pequeno onClick={() => setEditando(u)}>
                      Editar
                    </Button>
                    {u.ativo && (
                      <Button
                        variante="fantasma"
                        pequeno
                        disabled={novoLink.isPending}
                        onClick={() => novoLink.mutate(u)}
                      >
                        {u.pendente ? "Novo link" : "Redefinir senha"}
                      </Button>
                    )}
                    {!ehVoce &&
                      (u.ativo ? (
                        <Button variante="fantasma" pequeno onClick={() => setDesativando(u)}>
                          Desativar
                        </Button>
                      ) : (
                        <Button
                          variante="fantasma"
                          pequeno
                          disabled={reativar.isPending}
                          onClick={() => reativar.mutate(u)}
                        >
                          Reativar
                        </Button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Painel>

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
