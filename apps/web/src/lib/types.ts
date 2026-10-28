import type { Papel, TipoMovimentacao } from "@estoque/shared";

export type Usuario = { id: number; nome: string; email: string; papel: Papel };
export type Categoria = { id: number; nome: string };
export type Fornecedor = { id: number; nome: string; contato: string | null };

export type Produto = {
  id: number;
  sku: string;
  nome: string;
  categoriaId: number | null;
  unidade: string;
  precoCusto: number;
  precoVenda: number;
  estoqueMinimo: number;
  saldoAtual: number;
  ativo: boolean;
  criadoEm: string;
};

export type Movimentacao = {
  id: number;
  produtoId: number;
  produtoSku: string;
  produtoNome: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: string | null;
  fornecedorId: number | null;
  usuarioId: number;
  usuarioNome: string;
  criadoEm: string;
};

export type ResumoEstoque = {
  produtosAtivos: number;
  valorEmEstoque: number;
  abaixoDoMinimo: number;
  semEstoque: number;
};

export type { Pagina } from "@estoque/shared";
