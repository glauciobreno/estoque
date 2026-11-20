import type { Locator, Page } from "@playwright/test";

/** Clica num item do menu lateral (o sino do topo também tem "Produtos" no nome, então o escopo importa). */
export const irPara = (page: Page, nome: string) =>
  page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: nome }).click();

/** Abre o menu "···" de uma linha ou cartão e clica na opção. */
export async function escolherNoMenu(contexto: Locator | Page, opcao: string) {
  const pagina = "page" in contexto ? contexto.page() : contexto;
  await contexto.getByRole("button", { name: /^Ações de/ }).click();
  await pagina.getByRole("menuitem", { name: opcao }).click();
}
