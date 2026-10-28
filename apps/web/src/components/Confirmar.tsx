import { useMutation } from "@tanstack/react-query";
import { Button, Erro, Modal } from "./ui";

export function Confirmar({
  titulo,
  mensagem,
  rotuloConfirmar = "Excluir",
  acao,
  onConcluir,
  onFechar,
}: {
  titulo: string;
  mensagem: string;
  rotuloConfirmar?: string;
  acao: () => Promise<unknown>;
  onConcluir: () => void;
  onFechar: () => void;
}) {
  const mutacao = useMutation({ mutationFn: acao, onSuccess: onConcluir });
  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <p className="mb-4 text-sm text-slate-600">{mensagem}</p>
      {mutacao.error && (
        <div className="mb-4">
          <Erro erro={mutacao.error} />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variante="secundario" onClick={onFechar}>
          Cancelar
        </Button>
        <Button variante="perigo" disabled={mutacao.isPending} onClick={() => mutacao.mutate()}>
          {rotuloConfirmar}
        </Button>
      </div>
    </Modal>
  );
}
