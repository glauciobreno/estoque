import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function Quebrado({ quebrar }: { quebrar: boolean }) {
  if (quebrar) throw new Error("falha de renderização");
  return <p>tudo certo</p>;
}

describe("ErrorBoundary", () => {
  it("mostra uma mensagem amigável em vez de tela em branco", () => {
    render(
      <ErrorBoundary>
        <Quebrado quebrar />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Algo deu errado");
    expect(screen.queryByText("falha de renderização")).not.toBeInTheDocument();
  });

  it("não interfere quando não há erro", () => {
    render(
      <ErrorBoundary>
        <Quebrado quebrar={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("tudo certo")).toBeInTheDocument();
  });

  it("permite tentar novamente", async () => {
    function Teste() {
      const [quebrar, setQuebrar] = useState(true);
      return (
        <>
          <button onClick={() => setQuebrar(false)}>consertar</button>
          <ErrorBoundary>
            <Quebrado quebrar={quebrar} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Teste />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "consertar" }));
    await usuario.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByText("tudo certo")).toBeInTheDocument();
  });
});
