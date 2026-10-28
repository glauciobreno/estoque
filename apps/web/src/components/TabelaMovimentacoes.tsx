import { Link } from "react-router-dom";
import { formatData, formatQuantidade } from "../lib/format";
import type { Movimentacao } from "../lib/types";
import { SeloTipo } from "./SeloTipo";
import { celula, Tabela } from "./ui";

export function TabelaMovimentacoes({
  itens,
  mostrarProduto = true,
}: {
  itens: Movimentacao[];
  mostrarProduto?: boolean;
}) {
  return (
    <Tabela
      colunas={[
        "Data",
        ...(mostrarProduto ? ["Produto"] : []),
        "Tipo",
        "Quantidade",
        "Motivo",
        "Usuário",
      ]}
    >
      {itens.map((m) => (
        <tr key={m.id}>
          <td className={`${celula} whitespace-nowrap text-slate-500`}>{formatData(m.criadoEm)}</td>
          {mostrarProduto && (
            <td className={celula}>
              <Link
                to={`/produtos/${m.produtoId}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {m.produtoNome}
              </Link>
              <span className="ml-2 text-xs text-slate-500">{m.produtoSku}</span>
            </td>
          )}
          <td className={celula}>
            <SeloTipo tipo={m.tipo} />
          </td>
          <td
            className={`${celula} font-medium ${m.quantidade < 0 ? "text-red-600" : "text-emerald-700"}`}
          >
            {formatQuantidade(m.quantidade)}
          </td>
          <td className={`${celula} text-slate-600`}>{m.motivo ?? "—"}</td>
          <td className={`${celula} text-slate-600`}>{m.usuarioNome}</td>
        </tr>
      ))}
    </Tabela>
  );
}
