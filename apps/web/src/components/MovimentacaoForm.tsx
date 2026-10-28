import { movimentacaoSchema, TIPOS_MOVIMENTACAO, type TipoMovimentacao } from "@estoque/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Fornecedor, Pagina, Produto } from "../lib/types";
import { ProdutoPicker } from "./ProdutoPicker";
import { Button, Campo, Erro, Input, Modal, Select } from "./ui";

const rotulos: Record<TipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste (contagem)",
};

export function MovimentacaoForm({
  produto: inicial = null,
  onConcluir,
  onFechar,
}: {
  produto?: Produto | null;
  onConcluir: () => void;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoMovimentacao>("entrada");
  const [produto, setProduto] = useState<Produto | null>(inicial);
  const [quantidade, setQuantidade] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  const fornecedores = useQuery({
    queryKey: ["fornecedores", "todos"],
    queryFn: () => api<Pagina<Fornecedor>>("/fornecedores", { params: { pageSize: 100 } }),
    enabled: tipo === "entrada",
  });

  const mutacao = useMutation({
    mutationFn: (corpo: unknown) => api("/movimentacoes", { method: "POST", body: corpo }),
    onSuccess: async () => {
      await Promise.all(
        ["produtos", "movimentacoes", "alertas", "resumo"].map((chave) =>
          queryClient.invalidateQueries({ queryKey: [chave] }),
        ),
      );
      onConcluir();
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (!produto) novosErros.produto = "Selecione um produto";
    if (!/^\d+$/.test(quantidade)) {
      novosErros.quantidade =
        tipo === "ajuste"
          ? "Informe o saldo contado (inteiro ≥ 0)"
          : "Informe um inteiro maior que 0";
    }
    if (tipo === "ajuste" && !motivo.trim()) novosErros.motivo = "Informe o motivo do ajuste";

    const numero = Number(quantidade);
    const corpo = {
      tipo,
      produtoId: produto?.id,
      motivo: motivo.trim() || undefined,
      ...(tipo === "ajuste" ? { novoSaldo: numero } : { quantidade: numero }),
      ...(tipo === "entrada" && fornecedorId ? { fornecedorId: Number(fornecedorId) } : {}),
    };
    if (Object.keys(novosErros).length === 0) {
      const validado = movimentacaoSchema.safeParse(corpo);
      if (!validado.success)
        novosErros.quantidade = validado.error.issues[0]?.message ?? "Dados inválidos";
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length === 0) mutacao.mutate(corpo);
  }

  return (
    <Modal titulo="Nova movimentação" onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo rotulo="Tipo">
          {(id) => (
            <Select
              id={id}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMovimentacao)}
            >
              {TIPOS_MOVIMENTACAO.map((t) => (
                <option key={t} value={t}>
                  {rotulos[t]}
                </option>
              ))}
            </Select>
          )}
        </Campo>

        <Campo rotulo="Produto" erro={erros.produto}>
          {(id) => <ProdutoPicker id={id} valor={produto} onChange={setProduto} />}
        </Campo>

        <Campo
          rotulo={tipo === "ajuste" ? "Saldo contado" : "Quantidade"}
          erro={erros.quantidade}
          dica={
            tipo === "ajuste" && produto
              ? `Saldo atual no sistema: ${produto.saldoAtual} ${produto.unidade}`
              : undefined
          }
        >
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          )}
        </Campo>

        {tipo === "entrada" && (
          <Campo rotulo="Fornecedor (opcional)">
            {(id) => (
              <Select
                id={id}
                value={fornecedorId}
                onChange={(e) => setFornecedorId(e.target.value)}
              >
                <option value="">—</option>
                {fornecedores.data?.items.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            )}
          </Campo>
        )}

        <Campo rotulo={tipo === "ajuste" ? "Motivo" : "Motivo (opcional)"} erro={erros.motivo}>
          {(id) => (
            <Input
              id={id}
              value={motivo}
              maxLength={300}
              onChange={(e) => setMotivo(e.target.value)}
            />
          )}
        </Campo>

        {mutacao.error && <Erro erro={mutacao.error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutacao.isPending}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
