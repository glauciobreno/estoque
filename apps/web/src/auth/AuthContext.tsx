import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api, ApiError, definirAoPerderSessao } from "../lib/api";
import type { Usuario } from "../lib/types";
import { Carregando } from "../components/ui";

type Auth = {
  usuario: Usuario | null;
  ehAdmin: boolean;
  sessaoExpirada: boolean;
  login: (email: string, senha: string) => Promise<Usuario>;
  logout: () => Promise<void>;
  /** Primeiro acesso ou redefinição: grava a senha escolhida e já deixa a pessoa logada. */
  aceitarConvite: (token: string, senha: string) => Promise<Usuario>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  useEffect(() => {
    definirAoPerderSessao(() => {
      queryClient.clear();
      queryClient.setQueryData(["me"], null);
      setSessaoExpirada(true);
    });
    return () => definirAoPerderSessao(undefined);
  }, [queryClient]);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api<Usuario>("/auth/me").catch((erro) => {
        if (erro instanceof ApiError && erro.status === 401) return null;
        throw erro;
      }),
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, senha }: { email: string; senha: string }) =>
      api<Usuario>("/auth/login", { method: "POST", body: { email, senha } }),
    onSuccess: (usuario) => {
      setSessaoExpirada(false);
      queryClient.setQueryData(["me"], usuario);
    },
  });

  const conviteMutation = useMutation({
    mutationFn: ({ token, senha }: { token: string; senha: string }) =>
      api<Usuario>("/auth/convite/aceitar", { method: "POST", body: { token, senha } }),
    onSuccess: (usuario) => {
      setSessaoExpirada(false);
      // Descarta dados de uma sessão anterior, mas preserva a consulta ["me"]: o AuthProvider
      // está inscrito nela, e removê-la (clear) deixaria a tela presa ao usuário antigo.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      queryClient.setQueryData(["me"], usuario);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["me"], null);
    },
  });

  if (me.isPending) return <Carregando tela />;

  const usuario = me.data ?? null;
  const valor: Auth = {
    usuario,
    ehAdmin: usuario?.papel === "admin",
    sessaoExpirada,
    login: (email, senha) => loginMutation.mutateAsync({ email, senha }),
    logout: () => logoutMutation.mutateAsync(),
    aceitarConvite: (token, senha) => conviteMutation.mutateAsync({ token, senha }),
  };
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth fora do AuthProvider");
  return contexto;
}

export function RotaProtegida() {
  const { usuario } = useAuth();
  const local = useLocation();
  if (!usuario)
    return <Navigate to="/login" replace state={{ de: local.pathname + local.search }} />;
  return <Outlet />;
}

export function RotaAdmin() {
  const { ehAdmin } = useAuth();
  if (!ehAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
