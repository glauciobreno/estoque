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
