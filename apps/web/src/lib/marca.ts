export const NOME_SISTEMA = "Sistema de Estoque";

/** Nome mostrado no cartão do menu lateral e no breadcrumb. Defina VITE_NOME_EMPRESA para personalizar. */
export const NOME_EMPRESA =
  (import.meta.env.VITE_NOME_EMPRESA as string | undefined) || "Minha empresa";
