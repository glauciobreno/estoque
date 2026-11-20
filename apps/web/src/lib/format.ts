const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Valores monetários trafegam em centavos. */
export const formatBRL = (centavos: number) => brl.format(centavos / 100);

const brlInteiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** Valores de resumo (indicadores) aparecem em reais inteiros, como no design. */
export const formatBRLInteiro = (centavos: number) => brlInteiro.format(centavos / 100);

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

/** Datas ISO 8601 com fuso (ex.: 2026-11-27T20:00:00.000Z), como as de convite. */
export const formatDataIso = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "20 nov, 09:32" (a partir do timestamp UTC do banco, no fuso do navegador). */
export function formatDataCurta(criadoEm: string) {
  const d = new Date(`${criadoEm.replace(" ", "T")}Z`);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${d.getDate()} ${meses[d.getMonth()]}, ${hora}`;
}

/** Só o dia e o mês: "20 nov". */
export function formatDiaMes(criadoEm: string) {
  const d = new Date(`${criadoEm.replace(" ", "T")}Z`);
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

/** "+ 30 un." / "− 8 un." (o sinal de menos tipográfico é o do design). */
export const formatQuantidadeMov = (quantidade: number, unidade?: string) =>
  `${quantidade > 0 ? "+" : "−"} ${Math.abs(quantidade).toLocaleString("pt-BR")}${unidade ? ` ${abreviarUnidade(unidade)}` : ""}`;

/** Variação percentual entre dois meses; null quando não há base de comparação. */
export function variacaoPercentual(atual: number, anterior: number) {
  if (anterior <= 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export const formatPercentual = (valor: number) =>
  `${Math.abs(valor).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** "Novembro de 2026" */
export const mesPorExtenso = (data = new Date()) => {
  const texto = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1).replace(" de ", " de ");
};

/** Data local no formato AAAA-MM-DD, que é o que os filtros da API esperam. */
export const dataLocalISO = (data = new Date()) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

export const primeiroDiaDoMes = (data = new Date()) =>
  dataLocalISO(new Date(data.getFullYear(), data.getMonth(), 1));

/** "un" aparece como "un." (abreviação); outras unidades (kg, m...) ficam como estão. */
export const abreviarUnidade = (unidade: string) => (unidade === "un" ? "un." : unidade);
