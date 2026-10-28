const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

let aoPerderSessao: (() => void) | undefined;

/** Chamado quando uma rota protegida responde 401, ou seja, a sessão expirou. */
export function definirAoPerderSessao(callback: (() => void) | undefined) {
  aoPerderSessao = callback;
}

const MENSAGEM_REDE =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

function mensagemDeErro(status: number, dados: unknown): string {
  const corpo = (dados ?? {}) as {
    erro?: string;
    detalhes?: { message?: string }[];
    requestId?: string;
  };
  if (status === 502 || status === 503 || status === 504) {
    return "O servidor está indisponível no momento. Tente novamente em instantes.";
  }
  const detalhe = Array.isArray(corpo.detalhes) ? corpo.detalhes[0]?.message : undefined;
  const base = [corpo.erro ?? "Erro inesperado", detalhe].filter(Boolean).join(": ");
  return corpo.requestId ? `${base} (código ${corpo.requestId})` : base;
}

export async function api<T>(
  path: string,
  { method = "GET", body, params }: { method?: string; body?: unknown; params?: Params } = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") query.set(chave, String(valor));
  }
  const url = `${BASE}${path}${query.size ? `?${query}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, MENSAGEM_REDE);
  }

  if (res.status === 204) return undefined as T;
  const dados = await res.json().catch(() => null);
  if (!res.ok) {
    // /auth/* responde 401 por motivos próprios (senha errada, sem sessão ao abrir o app).
    if (res.status === 401 && !path.startsWith("/auth/")) aoPerderSessao?.();
    throw new ApiError(res.status, mensagemDeErro(res.status, dados));
  }
  return dados as T;
}
