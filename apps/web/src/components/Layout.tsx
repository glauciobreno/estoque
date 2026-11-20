import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { NOME_EMPRESA, NOME_SISTEMA } from "../lib/marca";
import { nomeDoPapel } from "../lib/papeis";
import type { ResumoEstoque } from "../lib/types";
import { AlterarSenhaForm } from "./AlterarSenhaForm";
import { ErrorBoundary } from "./ErrorBoundary";
import { Icone, type NomeIcone } from "./Icone";
import { MarcaSistema } from "./MarcaSistema";
import { Button, juntar } from "./ui";

type Item = {
  para: string;
  rotulo: string;
  icone: "dashboard" | "produtos" | "movimentacoes" | "categorias" | "fornecedores" | "usuarios";
  fim?: boolean;
  contagem?: number;
};

const titulos: [prefixo: string, titulo: string][] = [
  ["/produtos", "Produtos"],
  ["/movimentacoes", "Movimentações"],
  ["/categorias", "Categorias"],
  ["/fornecedores", "Fornecedores"],
  ["/usuarios", "Usuários"],
];

const ehMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function IconeSair() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-slate-600"
    >
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M16 8l4 4-4 4" />
      <path d="M20 12H9" />
    </svg>
  );
}

export function Layout() {
  const { usuario, logout, ehAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [busca, setBusca] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);

  const resumo = useQuery({
    queryKey: ["resumo"],
    queryFn: () => api<ResumoEstoque>("/estoque/resumo"),
  });

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        campoBusca.current?.focus();
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  const titulo = titulos.find(([prefixo]) => pathname.startsWith(prefixo))?.[1] ?? "Dashboard";
  const emAlerta = resumo.data?.abaixoDoMinimo ?? 0;
  const itens: Item[] = [
    { para: "/", rotulo: "Dashboard", icone: "dashboard", fim: true },
    {
      para: "/produtos",
      rotulo: "Produtos",
      icone: "produtos",
      contagem: resumo.data ? resumo.data.produtosAtivos + resumo.data.produtosInativos : undefined,
    },
    { para: "/movimentacoes", rotulo: "Movimentações", icone: "movimentacoes" },
    { para: "/categorias", rotulo: "Categorias", icone: "categorias" },
    { para: "/fornecedores", rotulo: "Fornecedores", icone: "fornecedores" },
    ...(ehAdmin ? [{ para: "/usuarios", rotulo: "Usuários", icone: "usuarios" } as const] : []),
  ];

  function buscar(e: FormEvent) {
    e.preventDefault();
    const termo = busca.trim();
    navigate(termo ? `/produtos?q=${encodeURIComponent(termo)}` : "/produtos");
    campoBusca.current?.blur();
  }

  const navegacao = (
    <nav aria-label="Principal" className="flex flex-col gap-1.5">
      {itens.map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          end={item.fim}
          onClick={() => setMenuAberto(false)}
          className={({ isActive }) =>
            juntar(
              "flex h-[42px] items-center gap-3 rounded-[7px] px-3.5 text-[13px]",
              isActive
                ? "bg-destaque font-semibold text-slate-900"
                : "text-slate-600 hover:bg-slate-200/50",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icone nome={(isActive ? `${item.icone}-ativo` : item.icone) as NomeIcone} />
              <span>{item.rotulo}</span>
              {item.contagem !== undefined && (
                <span className="ml-auto text-[11px] font-normal text-slate-500">
                  {item.contagem.toLocaleString("pt-BR")}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const acoesDaConta = (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          setMenuAberto(false);
          setTrocandoSenha(true);
        }}
        className="flex h-9 items-center gap-3 rounded-[7px] px-3.5 text-[12px] text-slate-600 hover:bg-slate-200/50"
      >
        <Icone nome="configuracoes" />
        Alterar senha
      </button>
      <button
        type="button"
        onClick={() => logout()}
        className="flex h-9 items-center gap-3 rounded-[7px] px-3.5 text-[12px] text-slate-600 hover:bg-slate-200/50"
      >
        <IconeSair />
        Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-lateral md:flex">
        <div className="px-[30px] pt-7">
          <MarcaSistema />
        </div>
        <div className="mx-4 mt-9 flex h-[58px] items-center gap-3 rounded-lg bg-[#faf9f5] px-3">
          <span className="h-6 w-1 shrink-0 rounded-sm bg-marca-600" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-slate-900">{NOME_EMPRESA}</p>
            <p className="text-[10px] text-slate-500">Workspace principal</p>
          </div>
        </div>
        <p className="mt-8 mb-3 px-7 text-[10px] font-medium tracking-[0.12em] text-slate-500">
          GERENCIAMENTO
        </p>
        <div className="px-4">{navegacao}</div>
        <div className="mt-auto px-4">
          <div className="mx-2 mb-4 h-px bg-slate-200" />
          {acoesDaConta}
          <p className="px-3.5 pt-6 pb-5 text-[10px] text-slate-500">
            © {new Date().getFullYear()} {NOME_SISTEMA}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-lateral px-4 py-3 md:hidden">
          <p className="font-serif text-[22px] leading-none text-slate-900">
            sistema{" "}
            <span className="text-[9px] font-sans font-semibold tracking-[0.26em] text-marca-600">
              DE ESTOQUE
            </span>
          </p>
          <Button
            variante="secundario"
            pequeno
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto(!menuAberto)}
          >
            {menuAberto ? "Fechar" : "Menu"}
          </Button>
        </header>
        {menuAberto && (
          <div className="border-b border-slate-200 bg-lateral p-4 md:hidden">
            {navegacao}
            <div className="mt-3 border-t border-slate-200 pt-3">{acoesDaConta}</div>
          </div>
        )}

        <header className="hidden h-20 items-center gap-6 border-b border-slate-200 px-10 md:flex">
          <nav aria-label="Você está em" className="flex items-center gap-3 text-[12px]">
            <span className="text-slate-500">{NOME_EMPRESA}</span>
            <Icone nome="chevron" />
            <span className="font-medium text-slate-900">{titulo}</span>
          </nav>
          <div className="ml-auto flex items-center gap-6">
            <form onSubmit={buscar} role="search" className="relative">
              <Icone
                nome="busca"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                ref={campoBusca}
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar no estoque"
                placeholder="Buscar no estoque..."
                className="h-9 w-[302px] appearance-none rounded-[7px] border-0 bg-[#f0eee7] pr-14 pl-9 text-[12px] text-slate-900 placeholder:text-slate-500 focus:ring-1 focus:ring-marca-600 focus:outline-none"
              />
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-sans text-[10px] text-slate-500"
              >
                {ehMac ? "⌘ K" : "Ctrl K"}
              </kbd>
            </form>
            <Link
              to="/produtos?aba=baixo"
              aria-label="Produtos com estoque baixo"
              className="relative rounded-md p-1 hover:bg-slate-100"
            >
              <Icone nome="sino" />
              {emAlerta > 0 && (
                <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-marca-600" />
              )}
            </Link>
            <span className="h-8 w-px bg-slate-200" />
            <div className="text-left">
              <p className="text-[12px] font-medium text-slate-900">{usuario?.nome}</p>
              <p className="text-[10px] text-slate-500">{usuario && nomeDoPapel(usuario.papel)}</p>
            </div>
          </div>
        </header>

        <main>
          <ErrorBoundary key={pathname}>
            <div className="mx-auto w-full max-w-[1208px] px-4 py-6 md:px-10 md:pt-9 md:pb-12">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
      {trocandoSenha && <AlterarSenhaForm onFechar={() => setTrocandoSenha(false)} />}
    </div>
  );
}
