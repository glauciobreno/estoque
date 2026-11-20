import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "../lib/api";
import { Button, Campo, Erro, Input, Modal } from "./ui";

export type CampoCadastro = { nome: string; rotulo: string; obrigatorio?: boolean; maximo: number };
export type Registro = { id: number } & Record<string, unknown>;

/** Modal de criar/editar para cadastros simples (categorias, fornecedores). */
export function FormCadastro({
  singular,
  novo,
  endpoint,
  campos,
  registro,
  onConcluir,
  onFechar,
}: {
  singular: string;
  /** "Novo" ou "Nova", conforme o gênero do cadastro. */
  novo: string;
  endpoint: string;
  campos: CampoCadastro[];
  registro?: Registro;
  onConcluir: () => void;
  onFechar: () => void;
}) {
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      campos.map((c) => [c.nome, String(registro?.[c.nome] ?? "")]),
    ),
  });

  const mutacao = useMutation({
    mutationFn: (valores: Record<string, string>) => {
      const corpo = Object.fromEntries(
        campos.map((c) => [c.nome, valores[c.nome]?.trim() || (c.obrigatorio ? "" : null)]),
      );
      return registro
        ? api(`${endpoint}/${registro.id}`, { method: "PUT", body: corpo })
        : api(endpoint, { method: "POST", body: corpo });
    },
    onSuccess: onConcluir,
  });

  return (
    <Modal titulo={registro ? `Editar ${singular}` : `${novo} ${singular}`} onFechar={onFechar}>
      <form onSubmit={handleSubmit((v) => mutacao.mutate(v))} className="space-y-4">
        {campos.map((c) => (
          <Campo key={c.nome} rotulo={c.rotulo}>
            {(id) => (
              <Input id={id} maxLength={c.maximo} required={c.obrigatorio} {...register(c.nome)} />
            )}
          </Campo>
        ))}
        {mutacao.error && <Erro erro={mutacao.error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutacao.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
