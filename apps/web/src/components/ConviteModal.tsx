import { useRef, useState } from "react";
import { formatDataIso } from "../lib/format";
import { Button, Input, Modal } from "./ui";

/** Endereço de primeiro acesso. O token fica no fragmento (#), que o navegador nunca envia ao servidor. */
export const linkDeConvite = (token: string) => `${window.location.origin}/ativar#${token}`;

export function ConviteModal({
  titulo,
  nome,
  token,
  expiraEm,
  redefinicao,
  onFechar,
}: {
  titulo: string;
  nome: string;
  token: string;
  expiraEm: string;
  redefinicao?: boolean;
  onFechar: () => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [copiado, setCopiado] = useState(false);
  const link = linkDeConvite(token);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      campo.current?.select(); // sem permissão de área de transferência: o usuário copia manualmente
    }
  }

  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <p className="mb-3 text-sm text-slate-600">
        Envie este link para <strong>{nome}</strong>.{" "}
        {redefinicao
          ? "Ao abri-lo, a pessoa escolhe uma nova senha; a senha atual continua valendo até lá."
          : "Ao abri-lo, a pessoa define a própria senha e já entra no sistema."}
      </p>
      <div className="flex gap-2">
        <Input
          ref={campo}
          readOnly
          aria-label="Link de acesso"
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button onClick={copiar}>{copiado ? "Copiado!" : "Copiar"}</Button>
      </div>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        O link vale até {formatDataIso(expiraEm)} e só funciona uma vez. Por segurança, ele não é
        mostrado de novo: se for preciso, gere outro.
      </p>
      <div className="mt-4 flex justify-end">
        <Button variante="secundario" onClick={onFechar}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}
