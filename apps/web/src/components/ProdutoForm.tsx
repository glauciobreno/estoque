import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "../lib/api";
import { centavosParaCampo, parseReais } from "../lib/format";
import type { Categoria, Pagina, Produto } from "../lib/types";
import { Button, Campo, Erro, Input, Modal, Select } from "./ui";

const preco = z.string().refine((v) => parseReais(v) !== null, "Valor inválido (ex.: 12,50)");

const schema = z.object({
  sku: z.string().trim().min(1, "Informe o SKU").max(50),
  nome: z.string().trim().min(1, "Informe o nome").max(150),
  categoriaId: z.string(),
  unidade: z.string().trim().min(1, "Informe a unidade").max(10),
  precoCusto: preco,
  precoVenda: preco,
  estoqueMinimo: z.string().regex(/^\d+$/, "Informe um inteiro maior ou igual a 0"),
  ativo: z.boolean(),
});
type Valores = z.infer<typeof schema>;

export function ProdutoForm({
  produto,
  onConcluir,
  onFechar,
}: {
  produto?: Produto;
  onConcluir: () => void;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const categorias = useQuery({
    queryKey: ["categorias", "todas"],
    queryFn: () => api<Pagina<Categoria>>("/categorias", { params: { pageSize: 100 } }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: produto?.sku ?? "",
      nome: produto?.nome ?? "",
      categoriaId: produto?.categoriaId ? String(produto.categoriaId) : "",
      unidade: produto?.unidade ?? "un",
      precoCusto: centavosParaCampo(produto?.precoCusto ?? 0),
      precoVenda: centavosParaCampo(produto?.precoVenda ?? 0),
      estoqueMinimo: String(produto?.estoqueMinimo ?? 0),
      ativo: produto?.ativo ?? true,
    },
  });

  const mutacao = useMutation({
    mutationFn: (v: Valores) => {
      const corpo = {
        sku: v.sku,
        nome: v.nome,
        categoriaId: v.categoriaId ? Number(v.categoriaId) : null,
        unidade: v.unidade,
        precoCusto: parseReais(v.precoCusto),
        precoVenda: parseReais(v.precoVenda),
        estoqueMinimo: Number(v.estoqueMinimo),
        ativo: v.ativo,
      };
      return produto
        ? api(`/produtos/${produto.id}`, { method: "PUT", body: corpo })
        : api("/produtos", { method: "POST", body: corpo });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["resumo"] });
      onConcluir();
    },
  });

  return (
    <Modal titulo={produto ? "Editar produto" : "Novo produto"} onFechar={onFechar}>
      <form onSubmit={handleSubmit((v) => mutacao.mutate(v))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="SKU" erro={errors.sku?.message}>
            {(id) => <Input id={id} {...register("sku")} />}
          </Campo>
          <Campo rotulo="Unidade" erro={errors.unidade?.message}>
            {(id) => <Input id={id} {...register("unidade")} />}
          </Campo>
        </div>
        <Campo rotulo="Nome" erro={errors.nome?.message}>
          {(id) => <Input id={id} {...register("nome")} />}
        </Campo>
        <Campo rotulo="Categoria">
          {(id) => (
            <Select id={id} {...register("categoriaId")}>
              <option value="">Sem categoria</option>
              {categorias.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          )}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Preço de custo (R$)" erro={errors.precoCusto?.message}>
            {(id) => <Input id={id} inputMode="decimal" {...register("precoCusto")} />}
          </Campo>
          <Campo rotulo="Preço de venda (R$)" erro={errors.precoVenda?.message}>
            {(id) => <Input id={id} inputMode="decimal" {...register("precoVenda")} />}
          </Campo>
          <Campo rotulo="Estoque mínimo" erro={errors.estoqueMinimo?.message}>
            {(id) => <Input id={id} inputMode="numeric" {...register("estoqueMinimo")} />}
          </Campo>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4 rounded" {...register("ativo")} />
          Produto ativo
        </label>
        {!produto && (
          <p className="text-xs text-slate-500">
            O saldo começa em 0. Registre uma entrada para lançar o estoque inicial.
          </p>
        )}

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
