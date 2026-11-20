import { NOME_SISTEMA } from "../lib/marca";

/** Marca do sistema: "sistema" em serifa e "DE ESTOQUE" em caixa alta na cor da marca. */
export function MarcaSistema({ centralizada }: { centralizada?: boolean }) {
  return (
    <div className={centralizada ? "text-center" : undefined} role="img" aria-label={NOME_SISTEMA}>
      <p aria-hidden="true" className="font-serif text-[34px] leading-none text-slate-900">
        sistema
      </p>
      <p
        aria-hidden="true"
        className="mt-2.5 text-[10px] font-semibold tracking-[0.26em] text-marca-600"
      >
        DE ESTOQUE
      </p>
    </div>
  );
}
