const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Valores monetários trafegam em centavos. */
export const formatBRL = (centavos: number) => brl.format(centavos / 100);

/** "12,50", "12.50" ou "1.234,56" → centavos. Vazio vale 0; inválido devolve null. */
export function parseReais(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, "");
  if (limpo === "") return 0;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return Math.round(Number(normalizado) * 100);
}

export const centavosParaCampo = (centavos: number) =>
  (centavos / 100).toFixed(2).replace(".", ",");

/** O banco grava CURRENT_TIMESTAMP em UTC ("YYYY-MM-DD HH:MM:SS"). */
export function formatData(criadoEm: string) {
  const data = new Date(`${criadoEm.replace(" ", "T")}Z`);
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export const formatQuantidade = (n: number) => (n > 0 ? `+${n}` : String(n));
