import type { TipoMovimentacao } from "@estoque/shared";
import { Selo } from "./ui";

const config = {
  entrada: { tom: "verde", rotulo: "Entrada" },
  saida: { tom: "vermelho", rotulo: "Saída" },
  ajuste: { tom: "azul", rotulo: "Ajuste" },
} as const;

export function SeloTipo({ tipo }: { tipo: TipoMovimentacao }) {
  return <Selo tom={config[tipo].tom}>{config[tipo].rotulo}</Selo>;
}
