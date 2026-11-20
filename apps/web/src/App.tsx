import { Navigate, Route, Routes } from "react-router-dom";
import { RotaAdmin, RotaProtegida } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Ativar } from "./pages/Ativar";
import { Categorias } from "./pages/Categorias";
import { Dashboard } from "./pages/Dashboard";
import { Fornecedores } from "./pages/Fornecedores";
import { Login } from "./pages/Login";
import { Movimentacoes } from "./pages/Movimentacoes";
import { ProdutoDetalhe } from "./pages/ProdutoDetalhe";
import { Produtos } from "./pages/Produtos";
import { Usuarios } from "./pages/Usuarios";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/ativar" element={<Ativar />} />
      <Route element={<RotaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="produtos/:id" element={<ProdutoDetalhe />} />
          <Route path="movimentacoes" element={<Movimentacoes />} />
          <Route element={<RotaAdmin />}>
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
          <Route path="categorias" element={<Categorias />} />
          <Route path="fornecedores" element={<Fornecedores />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
