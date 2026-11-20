import type { TipoMovimentacao } from "@estoque/shared";
import { Selo } from "./ui";

const config = {
  entrada: { tom: "verde", rotulo: "Entrada" },
  saida: { tom: "vermelho", rotulo: "Saída" },
  ajuste: { tom: "neutro", rotulo: "Ajuste" },
} as const;

export function SeloTipo({ tipo }: { tipo: TipoMovimentacao }) {
  return <Selo tom={config[tipo].tom}>{config[tipo].rotulo}</Selo>;
}

export const corDaQuantidade = (quantidade: number) =>
  quantidade > 0 ? "text-sucesso" : "text-marca-700";
