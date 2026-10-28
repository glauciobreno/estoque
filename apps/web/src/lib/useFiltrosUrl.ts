import { useSearchParams } from "react-router-dom";

/** Filtros e paginação na URL. `mudar` volta para a página 1, a menos que `page` seja informado. */
export function useFiltrosUrl() {
  const [params, setParams] = useSearchParams();

  function mudar(novos: Record<string, string>) {
    const proximo = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries({ page: "", ...novos })) {
      if (valor) proximo.set(chave, valor);
      else proximo.delete(chave);
    }
    setParams(proximo, { replace: true });
  }

  return { params, mudar };
}
