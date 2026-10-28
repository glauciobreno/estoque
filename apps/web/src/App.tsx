import { Navigate, Route, Routes } from "react-router-dom";
import { RotaProtegida } from "./auth/AuthContext";
import { CadastroSimples } from "./components/CadastroSimples";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Movimentacoes } from "./pages/Movimentacoes";
import { ProdutoDetalhe } from "./pages/ProdutoDetalhe";
import { Produtos } from "./pages/Produtos";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RotaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="produtos/:id" element={<ProdutoDetalhe />} />
          <Route path="movimentacoes" element={<Movimentacoes />} />
          <Route
            path="categorias"
            element={
              <CadastroSimples
                titulo="Categorias"
                singular="categoria"
                feminino
                endpoint="/categorias"
                campos={[{ nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 100 }]}
              />
            }
          />
          <Route
            path="fornecedores"
            element={
              <CadastroSimples
                titulo="Fornecedores"
                singular="fornecedor"
                endpoint="/fornecedores"
                campos={[
                  { nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 150 },
                  { nome: "contato", rotulo: "Contato", maximo: 200 },
                ]}
              />
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
