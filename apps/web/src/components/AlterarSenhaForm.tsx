import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "../lib/api";
import { Button, Campo, Erro, Input, Modal } from "./ui";

const schema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual"),
    novaSenha: z
      .string()
      .min(10, "Use pelo menos 10 caracteres")
      .max(72, "No máximo 72 caracteres"),
    confirmar: z.string(),
  })
  .refine((v) => v.novaSenha === v.confirmar, {
    message: "As senhas não conferem",
    path: ["confirmar"],
  });
type Valores = z.infer<typeof schema>;

export function AlterarSenhaForm({ onFechar }: { onFechar: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valores>({ resolver: zodResolver(schema) });

  const mutacao = useMutation({
    mutationFn: (v: Valores) =>
      api("/auth/senha", {
        method: "POST",
        body: { senhaAtual: v.senhaAtual, novaSenha: v.novaSenha },
      }),
  });

  return (
    <Modal titulo="Alterar senha" onFechar={onFechar}>
      {mutacao.isSuccess ? (
        <>
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Senha alterada com sucesso.
          </p>
          <div className="mt-4 flex justify-end">
            <Button onClick={onFechar}>Fechar</Button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit((v) => mutacao.mutate(v))} className="space-y-4" noValidate>
          <Campo rotulo="Senha atual" erro={errors.senhaAtual?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                {...register("senhaAtual")}
              />
            )}
          </Campo>
          <Campo
            rotulo="Nova senha"
            erro={errors.novaSenha?.message}
            dica="Mínimo de 10 caracteres."
          >
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                {...register("novaSenha")}
              />
            )}
          </Campo>
          <Campo rotulo="Confirmar nova senha" erro={errors.confirmar?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                {...register("confirmar")}
              />
            )}
          </Campo>
          {mutacao.error && <Erro erro={mutacao.error} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button variante="secundario" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutacao.isPending}>
              Alterar senha
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
