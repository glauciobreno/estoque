import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Campo, Carregando, Erro, Input } from "../components/ui";
import { api } from "../lib/api";

type Convite = { nome: string; email: string; redefinicao: boolean };

export function Ativar() {
  const { usuario, aceitarConvite } = useAuth();
  const { hash } = useLocation();
  // O token vem no fragmento da URL; é guardado em estado e removido da barra de endereço.
  const [token] = useState(() => hash.slice(1));
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const convite = useQuery({
    queryKey: ["convite", token],
    queryFn: () => api<Convite>("/auth/convite/verificar", { method: "POST", body: { token } }),
    enabled: token.length > 0,
    retry: false,
  });

  const aceitar = useMutation({ mutationFn: () => aceitarConvite(token, senha) });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 10) return setErroLocal("A senha deve ter pelo menos 10 caracteres");
    if (senha.length > 72) return setErroLocal("A senha deve ter no máximo 72 caracteres");
    if (senha !== confirmar) return setErroLocal("As senhas não conferem");
    setErroLocal(null);
    aceitar.mutate();
  }

  // Só navega quando o contexto já tem o usuário: navegar antes faria a rota protegida mandar
  // a pessoa ao login por um instante.
  if (aceitar.isSuccess && usuario) return <Navigate to="/" replace />;

  const invalido = token.length === 0 || convite.isError;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 text-center">
          <p className="text-3xl">📦</p>
          <h1 className="text-xl font-bold text-slate-900">Estoque</h1>
        </div>

        {token.length > 0 && convite.isPending ? (
          <Carregando />
        ) : invalido ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Este link é inválido ou expirou. Peça um novo link a quem administra o sistema.
            </p>
            <Link to="/login" className="text-sm text-marca-600 hover:underline">
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {convite.data?.redefinicao
                  ? "Redefinir senha"
                  : `Bem-vindo(a), ${convite.data?.nome}`}
              </h2>
              <p className="text-sm text-slate-500">
                {convite.data?.redefinicao
                  ? "Escolha uma nova senha para "
                  : "Defina a senha de acesso de "}
                <strong>{convite.data?.email}</strong>.
              </p>
            </div>
            <Campo rotulo="Senha" dica="Mínimo de 10 caracteres.">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Confirmar senha">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                />
              )}
            </Campo>
            {erroLocal && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {erroLocal}
              </p>
            )}
            {aceitar.error && <Erro erro={aceitar.error} />}
            <Button type="submit" className="w-full" disabled={aceitar.isPending}>
              {aceitar.isPending ? "Salvando…" : "Definir senha e entrar"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
