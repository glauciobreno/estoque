import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, pagina, renderizar, simularApi } from "../test/helpers";
import { MovimentacaoForm } from "./MovimentacaoForm";

afterEach(() => vi.unstubAllGlobals());

const produto = {
  id: 7,
  sku: "S-1",
  nome: "Sal",
  categoriaId: null,
  unidade: "kg",
  precoCusto: 0,
  precoVenda: 0,
  estoqueMinimo: 0,
  saldoAtual: 12,
  ativo: true,
  criadoEm: "2026-01-01 00:00:00",
};

async function montar(rotas = {}) {
  const chamadas = simularApi({
    "GET /auth/me": { corpo: admin },
    "GET /fornecedores": { corpo: pagina([{ id: 3, nome: "Acme", contato: null }]) },
    ...rotas,
  });
  const onConcluir = vi.fn();
  renderizar(<MovimentacaoForm produto={produto} onConcluir={onConcluir} onFechar={vi.fn()} />);
  await screen.findByLabelText("Tipo");
  return { chamadas, onConcluir };
}

describe("MovimentacaoForm", () => {
  it("valida a quantidade sem chamar a API", async () => {
    const { chamadas } = await montar();
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText("Quantidade"), "0");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(chamadas.some((c) => c.rota === "POST /movimentacoes")).toBe(false);
  });

  it("envia uma saída com a quantidade informada", async () => {
    const { chamadas, onConcluir } = await montar({
      "POST /movimentacoes": { status: 201, corpo: {} },
    });
    const usuario = userEvent.setup();
    await usuario.selectOptions(screen.getByLabelText("Tipo"), "saida");
    await usuario.type(screen.getByLabelText("Quantidade"), "5");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(onConcluir).toHaveBeenCalled());
    const envio = chamadas.find((c) => c.rota === "POST /movimentacoes");
    expect(envio?.corpo).toEqual({ tipo: "saida", produtoId: 7, quantidade: 5 });
  });

  it("ajuste exige motivo e envia o saldo contado", async () => {
    const { chamadas, onConcluir } = await montar({
      "POST /movimentacoes": { status: 201, corpo: {} },
    });
    const usuario = userEvent.setup();
    await usuario.selectOptions(screen.getByLabelText("Tipo"), "ajuste");
    expect(screen.getByText("Saldo atual no sistema: 12 kg")).toBeInTheDocument();
    await usuario.type(screen.getByLabelText("Saldo contado"), "9");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByText("Informe o motivo do ajuste")).toBeInTheDocument();

    await usuario.type(screen.getByLabelText("Motivo"), "contagem");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(onConcluir).toHaveBeenCalled());
    expect(chamadas.find((c) => c.rota === "POST /movimentacoes")?.corpo).toEqual({
      tipo: "ajuste",
      produtoId: 7,
      novoSaldo: 9,
      motivo: "contagem",
    });
  });

  it("mostra o erro devolvido pelo servidor", async () => {
    await montar({
      "POST /movimentacoes": { status: 409, corpo: { erro: "Saldo insuficiente: disponível 12" } },
    });
    const usuario = userEvent.setup();
    await usuario.selectOptions(screen.getByLabelText("Tipo"), "saida");
    await usuario.type(screen.getByLabelText("Quantidade"), "50");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByText("Saldo insuficiente: disponível 12")).toBeInTheDocument();
  });
});
