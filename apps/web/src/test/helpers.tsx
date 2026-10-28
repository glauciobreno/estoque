import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthContext";

type Resposta = { status?: number; corpo?: unknown };
type Rota = Resposta | ((corpo: unknown) => Resposta);

/** Substitui o fetch: cada chave é "MÉTODO /caminho" (sem /api e sem query string). */
export function simularApi(rotas: Record<string, Rota>) {
  const chamadas: { rota: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = new URL(url, "http://x").pathname.replace(/^\/api/, "");
      const rota = `${init?.method ?? "GET"} ${caminho}`;
      const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
      chamadas.push({ rota, corpo });
      const definicao = rotas[rota];
      if (!definicao)
        return new Response(JSON.stringify({ erro: `sem mock: ${rota}` }), { status: 500 });
      const { status = 200, corpo: resposta } =
        typeof definicao === "function" ? definicao(corpo) : definicao;
      return new Response(status === 204 ? null : JSON.stringify(resposta), { status });
    }),
  );
  return chamadas;
}

export function renderizar(ui: ReactElement, rota = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[rota]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const renderizarApp = (rota = "/") => renderizar(<App />, rota);

export const admin = { id: 1, nome: "Ana Admin", email: "ana@x.com", papel: "admin" };
export const operador = { id: 2, nome: "Beto Operador", email: "beto@x.com", papel: "operador" };
export const pagina = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
