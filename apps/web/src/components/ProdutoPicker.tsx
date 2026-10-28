import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { api } from "../lib/api";
import type { Pagina, Produto } from "../lib/types";
import { Button, Input } from "./ui";

function useDebounce<T>(valor: T, ms = 250) {
  const [atual, setAtual] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setAtual(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return atual;
}

export function ProdutoPicker({
  id,
  valor,
  onChange,
  apenasAtivos = true,
}: {
  id?: string;
  valor: Produto | null;
  onChange: (produto: Produto | null) => void;
  apenasAtivos?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const termo = useDebounce(busca.trim());
  const listaId = useId();

  const resultados = useQuery({
    queryKey: ["produtos", "picker", termo, apenasAtivos],
    queryFn: () =>
      api<Pagina<Produto>>("/produtos", {
        params: { q: termo, ativo: apenasAtivos ? true : undefined, pageSize: 8 },
      }),
    enabled: aberto && !valor,
  });

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-slate-900">{valor.nome}</p>
          <p className="text-xs text-slate-500">
            {valor.sku} · saldo {valor.saldoAtual} {valor.unidade}
          </p>
        </div>
        <Button variante="fantasma" pequeno onClick={() => onChange(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        autoComplete="off"
        placeholder="Buscar por nome ou SKU"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200"
        >
          {resultados.isPending && <li className="px-3 py-2 text-sm text-slate-500">Buscando…</li>}
          {resultados.data?.items.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">Nenhum produto encontrado</li>
          )}
          {resultados.data?.items.map((p) => (
            <li
              key={p.id}
              role="option"
              aria-selected={false}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-marca-50"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p);
                setBusca("");
                setAberto(false);
              }}
            >
              <span className="font-medium text-slate-900">{p.nome}</span>
              <span className="ml-2 text-xs text-slate-500">
                {p.sku} · saldo {p.saldoAtual}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
