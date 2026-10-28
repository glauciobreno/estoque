import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui";

type Props = { children: ReactNode; telaCheia?: boolean };
type Estado = { erro: Error | null };

/** Evita tela em branco quando um componente quebra durante a renderização. */
export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Erro de renderização:", erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${
          this.props.telaCheia ? "min-h-screen" : "min-h-64"
        }`}
      >
        <p className="text-4xl">⚠️</p>
        <h1 className="text-lg font-semibold text-slate-900">Algo deu errado</h1>
        <p className="max-w-sm text-sm text-slate-600">
          Ocorreu um erro inesperado ao exibir esta tela. Seus dados não foram afetados.
        </p>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={() => this.setState({ erro: null })}>
            Tentar novamente
          </Button>
          <Button onClick={() => window.location.assign("/")}>Ir para o início</Button>
        </div>
      </div>
    );
  }
}
