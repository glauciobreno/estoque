import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, definirAoPerderSessao } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  definirAoPerderSessao(undefined);
});

const responder = (status: number, corpo?: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })),
  );

describe("api", () => {
  it("traduz falha de rede em mensagem amigável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    const erro = (await api("/produtos").catch((e: unknown) => e)) as ApiError;
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({ status: 0 });
    expect(erro.message).toMatch(/conectar ao servidor/);
  });

  it("inclui o código da requisição em erros internos", async () => {
    responder(500, { erro: "Erro interno", requestId: "abc-123" });
    await expect(api("/produtos")).rejects.toThrow("Erro interno (código abc-123)");
  });

  it("não expõe corpo HTML de gateway: usa mensagem de indisponibilidade", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Bad Gateway</html>", { status: 502 })),
    );
    await expect(api("/produtos")).rejects.toThrow(/indisponível/);
  });

  it("junta o primeiro detalhe de validação à mensagem", async () => {
    responder(400, { erro: "Dados inválidos", detalhes: [{ message: "Too small" }] });
    await expect(api("/produtos", { method: "POST", body: {} })).rejects.toThrow(
      "Dados inválidos: Too small",
    );
  });

  it("avisa a perda de sessão em 401 de rotas protegidas", async () => {
    const aoPerder = vi.fn();
    definirAoPerderSessao(aoPerder);
    responder(401, { erro: "Não autenticado" });
    await expect(api("/produtos")).rejects.toThrow("Não autenticado");
    expect(aoPerder).toHaveBeenCalledTimes(1);
  });

  it("não trata como sessão perdida o 401 do login nem do /auth/me", async () => {
    const aoPerder = vi.fn();
    definirAoPerderSessao(aoPerder);
    responder(401, { erro: "E-mail ou senha inválidos" });
    await api("/auth/login", { method: "POST", body: {} }).catch(() => {});
    await api("/auth/me").catch(() => {});
    expect(aoPerder).not.toHaveBeenCalled();
  });

  it("monta a query string ignorando valores vazios e devolve undefined em 204", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const resultado = await api("/produtos", {
      params: { q: "", page: 2, ativo: false, x: undefined },
    });
    expect(resultado).toBeUndefined();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/produtos?page=2&ativo=false");
  });
});
