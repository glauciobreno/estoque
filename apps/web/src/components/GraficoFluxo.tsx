import type { DiaDeFluxo } from "../lib/types";
import { juntar } from "./ui";

const ALTURA = 176;
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PASSOS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];

/** Escolhe um passo "redondo" para que o eixo tenha 3 divisões acima de zero. */
export function escalaDoEixo(maximo: number) {
  if (maximo <= 0) return { passo: 1, topo: 3 };
  const bruto = maximo / 3;
  const passo = PASSOS.find((p) => p >= bruto) ?? Math.ceil(bruto / 10000) * 10000;
  return { passo, topo: passo * 3 };
}

function rotuloDoDia(data: string, indice: number, total: number) {
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  if (total <= 7) return SEMANA[new Date(ano, mes - 1, dia).getDay()]!;
  const intervalo = total <= 14 ? 1 : Math.ceil(total / 10);
  return indice % intervalo === 0 || indice === total - 1
    ? `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`
    : "";
}

/** Barras de entradas e saídas por dia. A legenda e o seletor de período ficam no painel. */
export function GraficoFluxo({ dias }: { dias: DiaDeFluxo[] }) {
  const maximo = Math.max(0, ...dias.flatMap((d) => [d.entradas, d.saidas]));
  const { passo, topo } = escalaDoEixo(maximo);
  const marcas = [0, 1, 2, 3].map((i) => i * passo);
  const larguraDaBarra = dias.length <= 7 ? "w-[17px]" : dias.length <= 14 ? "w-2.5" : "w-1.5";

  return (
    <div className="px-5 pt-5 pb-5">
      <div
        role="img"
        aria-label={`Entradas e saídas por dia nos últimos ${dias.length} dias`}
        className="relative ml-8"
      >
        <div className="absolute inset-x-0 top-0" style={{ height: ALTURA }}>
          {marcas.map((valor) => (
            <div
              key={valor}
              className="absolute inset-x-0 border-t border-[#f0eee8]"
              style={{ bottom: `${(valor / topo) * 100}%` }}
            >
              <span className="absolute top-0 -left-8 -translate-y-1/2 text-[9px] text-slate-500">
                {valor.toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
        <div className="relative flex justify-around">
          {dias.map((dia, i) => (
            <div key={dia.data} className="flex flex-col items-center">
              <div className="flex items-end gap-1.5" style={{ height: ALTURA }}>
                <div
                  className={juntar("rounded-[3px] bg-marca-600", larguraDaBarra)}
                  style={{ height: (dia.entradas / topo) * ALTURA }}
                />
                <div
                  className={juntar("rounded-[3px] bg-[#d4cec1]", larguraDaBarra)}
                  style={{ height: (dia.saidas / topo) * ALTURA }}
                />
              </div>
              <span className="mt-3 h-3 text-[10px] text-slate-500">
                {rotuloDoDia(dia.data, i, dias.length)}
              </span>
            </div>
          ))}
        </div>
        {maximo === 0 && (
          <p className="absolute inset-x-0 top-[72px] text-center text-[12px] text-slate-500">
            Nenhuma entrada ou saída neste período.
          </p>
        )}
      </div>
      <table className="sr-only">
        <caption>Entradas e saídas por dia</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Entradas</th>
            <th>Saídas</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.data}>
              <td>{d.data}</td>
              <td>{d.entradas}</td>
              <td>{d.saidas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
