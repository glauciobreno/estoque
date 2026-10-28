import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./ui";

const itens = [
  { para: "/", rotulo: "Dashboard", fim: true },
  { para: "/produtos", rotulo: "Produtos" },
  { para: "/movimentacoes", rotulo: "Movimentações" },
  { para: "/categorias", rotulo: "Categorias" },
  { para: "/fornecedores", rotulo: "Fornecedores" },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();

  const menu = (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {itens.map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          end={item.fim}
          onClick={() => setAberto(false)}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium ${
              isActive ? "bg-marca-50 text-marca-700" : "text-slate-600 hover:bg-slate-100"
            }`
          }
        >
          {item.rotulo}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <p className="mb-6 px-3 text-lg font-bold text-slate-900">📦 Estoque</p>
        {menu}
        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="truncate px-3 text-sm font-medium text-slate-900">{usuario?.nome}</p>
          <p className="mb-2 px-3 text-xs capitalize text-slate-500">{usuario?.papel}</p>
          <Button variante="fantasma" className="w-full justify-start" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <p className="font-bold text-slate-900">📦 Estoque</p>
        <Button
          variante="secundario"
          pequeno
          aria-expanded={aberto}
          onClick={() => setAberto(!aberto)}
        >
          {aberto ? "Fechar" : "Menu"}
        </Button>
      </header>
      {aberto && (
        <div className="border-b border-slate-200 bg-white p-4 md:hidden">
          {menu}
          <Button
            variante="fantasma"
            className="mt-3 w-full justify-start"
            onClick={() => logout()}
          >
            Sair ({usuario?.nome})
          </Button>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
