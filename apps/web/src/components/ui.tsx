import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

const juntar = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

const variantes = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 focus-visible:outline-marca-600",
  secundario: "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50",
  perigo: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
  fantasma: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variante = "primario",
  pequeno,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof variantes;
  pequeno?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={juntar(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        pequeno ? "px-2.5 py-1 text-sm" : "px-4 py-2 text-sm",
        variantes[variante],
        className,
      )}
    />
  );
}

const campoBase =
  "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-marca-600 focus:outline-none disabled:bg-slate-100";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} {...props} className={juntar(campoBase, className)} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} {...props} className={juntar(campoBase, className)} />;
  },
);

/**
 * Campo de busca que guarda o texto localmente e o repassa com debounce. O valor vindo da URL
 * só sobrescreve o texto quando mudou por outro caminho (link, voltar). O eco de um valor que o
 * próprio campo enviou é ignorado, mesmo chegando depois de um envio mais novo; do contrário,
 * caracteres digitados enquanto a URL ainda atualiza seriam descartados.
 */
export function CampoBusca({
  valor,
  onChange,
  atraso = 300,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  valor: string;
  onChange: (texto: string) => void;
  atraso?: number;
}) {
  const [texto, setTexto] = useState(valor);
  const enviados = useRef<string[]>([]);
  const ultimo = useRef(valor);
  const aoMudar = useRef(onChange);
  aoMudar.current = onChange;

  useEffect(() => {
    const indice = enviados.current.indexOf(valor);
    if (indice >= 0) {
      enviados.current.splice(0, indice + 1);
      return;
    }
    if (valor !== ultimo.current) {
      enviados.current = [];
      ultimo.current = valor;
      setTexto(valor);
    }
  }, [valor]);

  useEffect(() => {
    if (texto === ultimo.current) return;
    const id = setTimeout(() => {
      ultimo.current = texto;
      enviados.current.push(texto);
      aoMudar.current(texto);
    }, atraso);
    return () => clearTimeout(id);
  }, [texto, atraso]);

  return <Input {...props} value={texto} onChange={(e) => setTexto(e.target.value)} />;
}

export function Campo({
  rotulo,
  erro,
  dica,
  children,
}: {
  rotulo: string;
  erro?: string;
  dica?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {rotulo}
      </label>
      {children(id)}
      {dica && !erro && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
      {erro && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}

export function Modal({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  const tituloId = useId();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", aoTeclar);
    painel.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={tituloId} className="text-lg font-semibold text-slate-900">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const tons = {
  neutro: "bg-slate-100 text-slate-700",
  verde: "bg-emerald-100 text-emerald-800",
  vermelho: "bg-red-100 text-red-700",
  ambar: "bg-amber-100 text-amber-800",
  azul: "bg-sky-100 text-sky-800",
};

export function Selo({
  tom = "neutro",
  children,
}: {
  tom?: keyof typeof tons;
  children: ReactNode;
}) {
  return (
    <span
      className={juntar(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        tons[tom],
      )}
    >
      {children}
    </span>
  );
}

export function Painel({
  titulo,
  acao,
  children,
}: {
  titulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {titulo && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Carregando({ tela }: { tela?: boolean }) {
  return (
    <div
      role="status"
      className={juntar(
        "flex items-center justify-center text-slate-500",
        tela ? "min-h-screen" : "py-10",
      )}
    >
      <span className="mr-2 size-4 animate-spin rounded-full border-2 border-slate-300 border-t-marca-600" />
      Carregando…
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{children}</p>;
}

export function Erro({ erro }: { erro: unknown }) {
  const mensagem = erro instanceof Error ? erro.message : "Erro inesperado";
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
    >
      {mensagem}
    </p>
  );
}

export function Paginacao({
  page,
  pageSize,
  total,
  onMudar,
}: {
  page: number;
  pageSize: number;
  total: number;
  onMudar: (page: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600"
    >
      <span>
        Página {page} de {paginas} · {total} registros
      </span>
      <div className="flex gap-2">
        <Button
          variante="secundario"
          pequeno
          disabled={page <= 1}
          onClick={() => onMudar(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variante="secundario"
          pequeno
          disabled={page >= paginas}
          onClick={() => onMudar(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </nav>
  );
}

export function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {colunas.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const celula = "px-4 py-2.5 align-middle";
