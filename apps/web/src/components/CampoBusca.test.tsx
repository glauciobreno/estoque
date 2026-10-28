import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CampoBusca } from "./ui";

/** Simula a URL: o valor só volta ao campo depois de um atraso, como no router. */
function ComUrlLenta({ aoEnviar }: { aoEnviar: (t: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <>
      <CampoBusca
        aria-label="Buscar"
        valor={url}
        atraso={20}
        onChange={(t) => {
          aoEnviar(t);
          setTimeout(() => setUrl(t), 60);
        }}
      />
      <output>{url}</output>
    </>
  );
}

describe("CampoBusca", () => {
  it("não perde caracteres quando a URL atualiza depois da digitação", async () => {
    const aoEnviar = vi.fn();
    render(<ComUrlLenta aoEnviar={aoEnviar} />);
    const usuario = userEvent.setup({ delay: 30 });
    await usuario.type(screen.getByLabelText("Buscar"), "arroz 5kg");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("arroz 5kg"));
    expect(screen.getByLabelText("Buscar")).toHaveValue("arroz 5kg");
    expect(aoEnviar).toHaveBeenLastCalledWith("arroz 5kg");
  });

  it("agrupa a digitação em poucas chamadas", async () => {
    const aoEnviar = vi.fn();
    render(<ComUrlLenta aoEnviar={aoEnviar} />);
    await userEvent.setup({ delay: 1 }).type(screen.getByLabelText("Buscar"), "abcdef");
    await waitFor(() => expect(aoEnviar).toHaveBeenCalled());
    expect(aoEnviar.mock.calls.length).toBeLessThan(3);
  });

  it("acompanha mudanças externas do valor", () => {
    const { rerender } = render(<CampoBusca aria-label="Buscar" valor="" onChange={() => {}} />);
    rerender(<CampoBusca aria-label="Buscar" valor="feijão" onChange={() => {}} />);
    expect(screen.getByLabelText("Buscar")).toHaveValue("feijão");
  });
});
