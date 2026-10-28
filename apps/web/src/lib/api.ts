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

export async function api<T>(
  path: string,
  { method = "GET", body, params }: { method?: string; body?: unknown; params?: Params } = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") query.set(chave, String(valor));
  }
  const url = `${BASE}${path}${query.size ? `?${query}` : ""}`;

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;
  const dados = await res.json().catch(() => null);
  if (!res.ok) {
    const detalhe = Array.isArray(dados?.detalhes) ? dados.detalhes[0]?.message : undefined;
    const mensagem = [dados?.erro ?? "Erro inesperado", detalhe].filter(Boolean).join(": ");
    throw new ApiError(res.status, mensagem);
  }
  return dados as T;
}
