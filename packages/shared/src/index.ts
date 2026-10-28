export const TIPOS_MOVIMENTACAO = ["entrada", "saida", "ajuste"] as const;
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number];
