import { Link } from "react-router-dom";
import { formatDataCurta, formatQuantidadeMov } from "../lib/format";
import type { Movimentacao } from "../lib/types";
import { SeloTipo, corDaQuantidade } from "./SeloTipo";
import { celula, Tabela } from "./ui";

export const codigoDaMovimentacao = (id: number) => `#MOV-${String(id).padStart(4, "0")}`;

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
        "ID",
        ...(mostrarProduto ? ["Produto"] : []),
        "Tipo",
        "Qtd.",
        "Motivo",
        "Responsável",
        "Data",
        "",
      ]}
    >
      {itens.map((m) => (
        <tr key={m.id}>
          <td className={`${celula} text-[11px] whitespace-nowrap text-slate-500`}>
            {codigoDaMovimentacao(m.id)}
          </td>
          {mostrarProduto && (
            <td className={celula}>
              <Link
                to={`/produtos/${m.produtoId}`}
                className="text-[11px] font-medium text-slate-900 hover:underline"
              >
                {m.produtoNome}
              </Link>
              <span className="ml-2 text-[10px] text-slate-500">{m.produtoSku}</span>
            </td>
          )}
          <td className={celula}>
            <SeloTipo tipo={m.tipo} />
          </td>
          <td
            className={`${celula} text-[11px] font-medium whitespace-nowrap ${corDaQuantidade(m.quantidade)}`}
          >
            {formatQuantidadeMov(m.quantidade)}
          </td>
          <td className={`${celula} text-[11px] text-slate-600`}>{m.motivo ?? "—"}</td>
          <td className={`${celula} text-[11px] text-slate-900`}>{m.usuarioNome}</td>
          <td className={`${celula} text-[11px] whitespace-nowrap text-slate-900`}>
            {formatDataCurta(m.criadoEm)}
          </td>
          <td className={`${celula} text-right`}>
            {mostrarProduto && (
              <Link
                to={`/produtos/${m.produtoId}`}
                aria-label={`Ver produto ${m.produtoNome}`}
                className="text-[14px] text-slate-500 hover:text-marca-600"
              >
                ↗
              </Link>
            )}
          </td>
        </tr>
      ))}
    </Tabela>
  );
}
