import { PAPEIS, type Papel } from "@estoque/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "../lib/api";
import type { Convite, UsuarioAdmin } from "../lib/types";
import { Button, Campo, Erro, Input, Modal, Select } from "./ui";

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(100),
  email: z.email("Informe um e-mail válido"),
  papel: z.enum(PAPEIS),
});
type Valores = z.infer<typeof schema>;

const rotuloPapel: Record<Papel, string> = { admin: "Administrador", operador: "Operador" };
export const nomeDoPapel = (papel: Papel) => rotuloPapel[papel];

/** Cria (sem `usuario`) ou edita nome e papel (com `usuario`). O e-mail não muda depois de criado. */
export function UsuarioForm({
  usuario,
  ehVoce,
  onCriado,
  onSalvo,
  onFechar,
}: {
  usuario?: UsuarioAdmin;
  ehVoce?: boolean;
  onCriado?: (resultado: { usuario: UsuarioAdmin; convite: Convite }) => void;
  onSalvo?: () => void;
  onFechar: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: usuario?.nome ?? "",
      email: usuario?.email ?? "",
      papel: usuario?.papel ?? "operador",
    },
  });

  const mutacao = useMutation({
    mutationFn: async (v: Valores) => {
      if (usuario) {
        await api(`/usuarios/${usuario.id}`, {
          method: "PATCH",
          body: { nome: v.nome, ...(ehVoce ? {} : { papel: v.papel }) },
        });
        return null;
      }
      return api<{ usuario: UsuarioAdmin; convite: Convite }>("/usuarios", {
        method: "POST",
        body: v,
      });
    },
    onSuccess: (criado) => (criado ? onCriado?.(criado) : onSalvo?.()),
  });

  return (
    <Modal titulo={usuario ? "Editar usuário" : "Novo usuário"} onFechar={onFechar}>
      <form onSubmit={handleSubmit((v) => mutacao.mutate(v))} className="space-y-4" noValidate>
        <Campo rotulo="Nome" erro={errors.nome?.message}>
          {(id) => <Input id={id} {...register("nome")} />}
        </Campo>
        <Campo rotulo="E-mail" erro={errors.email?.message}>
          {(id) => <Input id={id} type="email" disabled={!!usuario} {...register("email")} />}
        </Campo>
        <Campo
          rotulo="Papel"
          dica={
            ehVoce
              ? "Você não pode alterar o próprio papel."
              : "Administradores gerenciam cadastros e usuários; operadores registram movimentações."
          }
        >
          {(id) => (
            <Select id={id} disabled={ehVoce} {...register("papel")}>
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {rotuloPapel[p]}
                </option>
              ))}
            </Select>
          )}
        </Campo>
        {!usuario && (
          <p className="text-xs text-slate-500">
            Você não define a senha: ao salvar, o sistema gera um link de primeiro acesso para
            enviar à pessoa, que escolhe a própria senha.
          </p>
        )}
        {mutacao.error && <Erro erro={mutacao.error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutacao.isPending}>
            {usuario ? "Salvar" : "Criar e gerar link"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
