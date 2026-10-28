import { loginSchema } from "@estoque/shared";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Campo, Input } from "../components/ui";
import { ApiError } from "../lib/api";

export function Login() {
  const { usuario, login, sessaoExpirada } = useAuth();
  const navigate = useNavigate();
  const destino = (useLocation().state as { de?: string } | null)?.de ?? "/";
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const validado = loginSchema.safeParse({
      email: dados.get("email"),
      senha: dados.get("senha"),
    });
    if (!validado.success) {
      setErro("Informe um e-mail válido e a senha");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await login(validado.data.email, validado.data.senha);
      navigate(destino, { replace: true });
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 401
          ? e.message
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={enviar}
        noValidate
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <div className="text-center">
          <p className="text-3xl">📦</p>
          <h1 className="text-xl font-bold text-slate-900">Estoque</h1>
          <p className="text-sm text-slate-500">Entre para continuar</p>
        </div>
        <Campo rotulo="E-mail">
          {(id) => <Input id={id} name="email" type="email" autoComplete="username" autoFocus />}
        </Campo>
        <Campo rotulo="Senha">
          {(id) => <Input id={id} name="senha" type="password" autoComplete="current-password" />}
        </Campo>
        {sessaoExpirada && !erro && (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )}
        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
