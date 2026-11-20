import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Abas, MenuAcoes, Paginacao, Select } from "./ui";

describe("Paginacao", () => {
  it("mostra o intervalo e as páginas, com reticências quando são muitas", async () => {
    const aoMudar = vi.fn();
    render(<Paginacao page={5} pageSize={10} total={420} rotulo="produtos" onMudar={aoMudar} />);
    expect(screen.getByText("Mostrando 41–50 de 420 produtos")).toBeInTheDocument();

    const paginas = screen
      .getAllByRole("button", { name: /^Página \d+$/ })
      .map((b) => b.textContent);
    expect(paginas).toEqual(["1", "2", "4", "5", "6", "42"]);
    expect(screen.getByRole("button", { name: "Página 5" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Página 6" }));
    await usuario.click(screen.getByRole("button", { name: "Próxima página" }));
    await usuario.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(aoMudar.mock.calls).toEqual([[6], [6], [4]]);
  });

  it("desabilita voltar na primeira página e avançar na última", () => {
    const { rerender } = render(<Paginacao page={1} pageSize={10} total={25} onMudar={() => {}} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();
    rerender(<Paginacao page={3} pageSize={10} total={25} onMudar={() => {}} />);
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    expect(screen.getByText("Mostrando 21–25 de 25 registros")).toBeInTheDocument();
  });

  it("com uma página só mostra o total, sem botões; sem registros não aparece", () => {
    const { rerender } = render(
      <Paginacao page={1} pageSize={10} total={6} rotulo="produtos" onMudar={() => {}} />,
    );
    expect(screen.getByText("Mostrando 1–6 de 6 produtos")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<Paginacao page={1} pageSize={10} total={0} onMudar={() => {}} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("formata milhares no padrão brasileiro", () => {
    render(
      <Paginacao page={1} pageSize={10} total={1284} rotulo="movimentações" onMudar={() => {}} />,
    );
    expect(screen.getByText("Mostrando 1–10 de 1.284 movimentações")).toBeInTheDocument();
  });
});

describe("Abas", () => {
  it("marca a aba ativa, mostra contagens e avisa a troca", async () => {
    const aoMudar = vi.fn();
    render(
      <Abas
        rotulo="Situação"
        ativa="todos"
        onMudar={aoMudar}
        abas={[
          { id: "todos", rotulo: "Todos", contagem: 1284 },
          { id: "baixo", rotulo: "Estoque baixo", contagem: 12 },
          { id: "sem", rotulo: "Sem contagem" },
        ]}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Situação" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Todos 1.284" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Estoque baixo 12" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Sem contagem" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Estoque baixo 12" }));
    expect(aoMudar).toHaveBeenCalledWith("baixo");
  });
});

describe("MenuAcoes", () => {
  it("abre, executa a ação escolhida e fecha", async () => {
    const editar = vi.fn();
    render(
      <MenuAcoes
        rotulo="Arroz"
        itens={[
          { rotulo: "Editar", onClick: editar },
          { rotulo: "Excluir", onClick: () => {}, perigo: true },
        ]}
      />,
    );
    const usuario = userEvent.setup();
    const botao = screen.getByRole("button", { name: "Ações de Arroz" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await usuario.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveClass("text-red-700");

    await usuario.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(editar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fecha com Escape e ao clicar fora", async () => {
    render(
      <div>
        <p>fora</p>
        <MenuAcoes rotulo="X" itens={[{ rotulo: "Editar", onClick: () => {} }]} />
      </div>,
    );
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Ações de X" }));
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Ações de X" }));
    await usuario.click(screen.getByText("fora"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("não aparece quando não há ações permitidas", () => {
    render(<MenuAcoes rotulo="X" itens={[]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Select", () => {
  it("aplica a largura ao contêiner e mantém o campo em largura total", () => {
    const { container } = render(
      <Select aria-label="Categoria" className="w-[218px]">
        <option>Todas</option>
      </Select>,
    );
    expect(container.firstElementChild).toHaveClass("w-[218px]");
    expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveClass("w-full");
  });

  it("sem className ocupa a largura toda; o modo discreto não tem borda", () => {
    const { container, rerender } = render(
      <Select aria-label="A">
        <option>x</option>
      </Select>,
    );
    expect(container.firstElementChild).toHaveClass("w-full");
    rerender(
      <Select aria-label="A" discreto>
        <option>x</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).not.toHaveClass("border");
  });
});
