import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Icone } from "./Icone";

export const juntar = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

const variantes = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 focus-visible:outline-marca-600",
  secundario: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  perigo: "bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700",
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
        "inline-flex items-center justify-center gap-2 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        pequeno ? "px-2.5 py-1.5" : "h-[39px] px-4",
        variantes[variante],
        className,
      )}
    />
  );
}

const campoBase =
  "w-full rounded-md border border-slate-200 bg-campo px-3 py-2.5 text-[12px] text-slate-900 placeholder:text-slate-500 focus:border-marca-600 focus:ring-1 focus:ring-marca-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} {...props} className={juntar(campoBase, className)} />;
  },
);

/**
 * Seletor com a seta do design. `className` vai para o contêiner (use-o para a largura); com
 * `discreto` o campo some e fica só o texto e a seta, como no seletor de período do gráfico.
 */
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { discreto?: boolean }
>(function Select({ className, discreto, ...props }, ref) {
  return (
    <div className={juntar("relative", className ?? "w-full")}>
      <select
        ref={ref}
        {...props}
        className={
          discreto
            ? "w-full cursor-pointer appearance-none bg-transparent py-1 pr-6 text-[11px] text-slate-900 focus:outline-none"
            : juntar(campoBase, "appearance-none pr-9")
        }
      />
      <Icone
        nome="seta-baixo"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  );
});

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
  comIcone,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  valor: string;
  onChange: (texto: string) => void;
  atraso?: number;
  /** Mostra a lupa do design à esquerda do campo. */
  comIcone?: boolean;
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

  const campo = (
    <Input
      {...props}
      className={juntar(comIcone && "pl-10", className)}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
    />
  );
  if (!comIcone) return campo;
  return (
    <div className="relative w-full">
      <Icone
        nome="buscar"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      {campo}
    </div>
  );
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
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-slate-900">
        {rotulo}
      </label>
      {children(id)}
      {dica && !erro && <p className="mt-1 text-[11px] text-slate-500">{dica}</p>}
      {erro && (
        <p role="alert" className="mt-1 text-[11px] text-red-700">
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-6 shadow-xl sm:rounded-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id={tituloId} className="font-serif text-[22px] text-slate-900">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
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
  neutro: "bg-neutro-fundo text-neutro-texto",
  verde: "bg-sucesso-fundo text-sucesso",
  vermelho: "bg-marca-50 text-marca-700",
  ambar: "bg-marca-100 text-marca-600",
  azul: "bg-neutro-fundo text-neutro-texto",
};

export function Selo({
  tom = "neutro",
  ponto,
  children,
}: {
  tom?: keyof typeof tons;
  /** Prefixa o texto com a bolinha usada nos status do design. */
  ponto?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={juntar(
        "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[10px] font-medium whitespace-nowrap",
        tons[tom],
      )}
    >
      {ponto && <span aria-hidden="true">●</span>}
      {children}
    </span>
  );
}

export function Painel({
  titulo,
  descricao,
  acao,
  className,
  children,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={juntar("rounded-[10px] border border-slate-200 bg-white", className)}>
      {titulo && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">{titulo}</h2>
            {descricao && <p className="mt-1 text-[11px] text-slate-500">{descricao}</p>}
          </div>
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
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-[32px] leading-tight text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-2 text-[13px] text-slate-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-3 pt-2">{acoes}</div>}
    </div>
  );
}

/** Cartão de indicador do design: rótulo pequeno, número grande em serifa e uma linha de apoio. */
export function Indicador({
  rotulo,
  valor,
  apoio,
  tom,
  className,
}: {
  rotulo: string;
  valor: ReactNode;
  apoio?: ReactNode;
  tom?: "marca" | "sucesso" | "cinza";
  className?: string;
}) {
  const cor =
    tom === "marca"
      ? "text-marca-600"
      : tom === "sucesso"
        ? "text-sucesso"
        : tom === "cinza"
          ? "text-neutro-texto"
          : "text-slate-900";
  return (
    <div className={juntar("rounded-[10px] border border-slate-200 bg-white px-5 py-4", className)}>
      <p className="text-[12px] text-slate-500">{rotulo}</p>
      <p className={juntar("mt-2 font-serif text-[29px] leading-tight", cor)}>{valor}</p>
      {apoio && <p className="mt-3 text-[10px] text-slate-500">{apoio}</p>}
    </div>
  );
}

export function Abas<T extends string>({
  abas,
  ativa,
  onMudar,
  rotulo,
}: {
  abas: { id: T; rotulo: string; contagem?: number }[];
  ativa: T;
  onMudar: (id: T) => void;
  rotulo: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className="flex gap-8 overflow-x-auto border-b border-slate-200 px-5"
    >
      {abas.map((aba) => {
        const selecionada = aba.id === ativa;
        return (
          <button
            key={aba.id}
            type="button"
            role="tab"
            aria-selected={selecionada}
            onClick={() => onMudar(aba.id)}
            className={juntar(
              "-mb-px border-b-2 py-4 text-[13px] whitespace-nowrap",
              selecionada
                ? "border-marca-600 font-semibold text-marca-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {aba.rotulo}
            {aba.contagem !== undefined && " "}
            {aba.contagem !== undefined && (
              <span
                className={juntar("ml-2 text-[12px]", selecionada ? "font-medium" : "font-normal")}
              >
                {aba.contagem.toLocaleString("pt-BR")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Carregando({ tela }: { tela?: boolean }) {
  return (
    <div
      role="status"
      className={juntar(
        "flex items-center justify-center text-[13px] text-slate-500",
        tela ? "min-h-screen" : "py-10",
      )}
    >
      <span className="mr-2 size-4 animate-spin rounded-full border-2 border-slate-300 border-t-marca-600" />
      Carregando…
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-5 py-12 text-center text-[13px] text-slate-500">{children}</p>;
}

export function Erro({ erro }: { erro: unknown }) {
  const mensagem = erro instanceof Error ? erro.message : "Erro inesperado";
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
    >
      {mensagem}
    </p>
  );
}

function paginasVisiveis(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const conjunto = [...new Set([1, 2, atual - 1, atual, atual + 1, total])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const lista: (number | "…")[] = [];
  conjunto.forEach((n, i) => {
    const anterior = conjunto[i - 1];
    if (anterior !== undefined && n - anterior > 1) lista.push("…");
    lista.push(n);
  });
  return lista;
}

export function Paginacao({
  page,
  pageSize,
  total,
  onMudar,
  rotulo = "registros",
}: {
  page: number;
  pageSize: number;
  total: number;
  onMudar: (page: number) => void;
  rotulo?: string;
}) {
  if (total === 0) return null;
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  const primeiro = (page - 1) * pageSize + 1;
  const ultimo = Math.min(page * pageSize, total);
  const botao =
    "flex h-[30px] min-w-[26px] items-center justify-center rounded-[5px] border border-slate-200 bg-white px-1.5 text-[11px] text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 text-[11px] text-slate-500"
    >
      <span>
        Mostrando {primeiro.toLocaleString("pt-BR")}–{ultimo.toLocaleString("pt-BR")} de{" "}
        {total.toLocaleString("pt-BR")} {rotulo}
      </span>
      {paginas > 1 && (
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Página anterior"
            className={botao}
            disabled={page <= 1}
            onClick={() => onMudar(page - 1)}
          >
            ‹
          </button>
          {paginasVisiveis(page, paginas).map((n, i) =>
            n === "…" ? (
              <span key={`r${i}`} className={juntar(botao, "pointer-events-none")}>
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                aria-label={`Página ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={juntar(
                  botao,
                  n === page && "border-marca-100 bg-marca-100 text-marca-700",
                )}
                onClick={() => onMudar(n)}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Próxima página"
            className={botao}
            disabled={page >= paginas}
            onClick={() => onMudar(page + 1)}
          >
            ›
          </button>
        </div>
      )}
    </nav>
  );
}

export function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-cabecalho text-[9px] tracking-[0.06em] text-slate-500 uppercase">
          <tr>
            {colunas.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-5 py-3 font-medium whitespace-nowrap first:pl-5"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-linha first:[&>tr]:border-t-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export const celula = "px-5 py-3.5 align-middle";
/** Linhas mais baixas, para tabelas de resumo (ex.: movimentações recentes no dashboard). */
export const celulaCompacta = "px-5 py-2 align-middle";

export type ItemMenu = { rotulo: string; onClick: () => void; perigo?: boolean };

/** Menu "···" das linhas e cartões. */
export function MenuAcoes({ rotulo, itens }: { rotulo: string; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  if (itens.length === 0) return null;
  return (
    <div ref={raiz} className="relative inline-block">
      <button
        type="button"
        aria-label={`Ações de ${rotulo}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
        className="rounded-md px-2 text-[18px] leading-none text-slate-500 hover:bg-slate-100"
      >
        ···
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                item.onClick();
              }}
              className={juntar(
                "block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50",
                item.perigo ? "text-red-700" : "text-slate-900",
              )}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
