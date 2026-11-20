import ajuda from "../assets/icones/ajuda.svg";
import busca from "../assets/icones/busca.svg";
import buscar from "../assets/icones/buscar.svg";
import categorias from "../assets/icones/categorias.svg";
import categoriasAtivo from "../assets/icones/categorias-ativo.svg";
import chevron from "../assets/icones/chevron.svg";
import configuracoes from "../assets/icones/configuracoes.svg";
import dashboard from "../assets/icones/dashboard.svg";
import dashboardAtivo from "../assets/icones/dashboard-ativo.svg";
import fornecedores from "../assets/icones/fornecedores.svg";
import fornecedoresAtivo from "../assets/icones/fornecedores-ativo.svg";
import movimentacoes from "../assets/icones/movimentacoes.svg";
import movimentacoesAtivo from "../assets/icones/movimentacoes-ativo.svg";
import produtos from "../assets/icones/produtos.svg";
import produtosAtivo from "../assets/icones/produtos-ativo.svg";
import setaBaixo from "../assets/icones/seta-baixo.svg";
import sino from "../assets/icones/sino.svg";
import usuarios from "../assets/icones/usuarios.svg";
import usuariosAtivo from "../assets/icones/usuarios-ativo.svg";

/** Ícones exportados do Figma, com o tamanho original de cada um. */
const icones = {
  ajuda: { src: ajuda, tamanho: 18 },
  busca: { src: busca, tamanho: 16 },
  buscar: { src: buscar, tamanho: 20 },
  categorias: { src: categorias, tamanho: 18 },
  "categorias-ativo": { src: categoriasAtivo, tamanho: 18 },
  chevron: { src: chevron, tamanho: 13 },
  configuracoes: { src: configuracoes, tamanho: 18 },
  dashboard: { src: dashboard, tamanho: 18 },
  "dashboard-ativo": { src: dashboardAtivo, tamanho: 18 },
  fornecedores: { src: fornecedores, tamanho: 18 },
  "fornecedores-ativo": { src: fornecedoresAtivo, tamanho: 18 },
  movimentacoes: { src: movimentacoes, tamanho: 18 },
  "movimentacoes-ativo": { src: movimentacoesAtivo, tamanho: 18 },
  produtos: { src: produtos, tamanho: 18 },
  "produtos-ativo": { src: produtosAtivo, tamanho: 18 },
  "seta-baixo": { src: setaBaixo, tamanho: 14 },
  sino: { src: sino, tamanho: 20 },
  usuarios: { src: usuarios, tamanho: 18 },
  "usuarios-ativo": { src: usuariosAtivo, tamanho: 18 },
} as const;

export type NomeIcone = keyof typeof icones;

export function Icone({ nome, className }: { nome: NomeIcone; className?: string }) {
  const { src, tamanho } = icones[nome];
  return (
    <img
      src={src}
      alt=""
      width={tamanho}
      height={tamanho}
      className={`shrink-0 ${className ?? ""}`}
    />
  );
}
