import { expect, test } from "@playwright/test";
import { irPara } from "./auxiliares";
import { SESSAO_ADMIN } from "./usuarios";

test.use({ storageState: SESSAO_ADMIN });

test("as telas funcionam sob a CSP de produção, sem violações, com as fontes do design", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective}: ${e.blockedURI}`,
      ),
    );
  });

  const resposta = await page.goto("/");
  expect(resposta?.headers()["content-security-policy"]).toContain("script-src 'self'");

  const telas: [menu: string, titulo: string][] = [
    ["Produtos", "Produtos"],
    ["Movimentações", "Movimentações"],
    ["Categorias", "Categorias"],
    ["Fornecedores", "Fornecedores"],
    ["Usuários", "Usuários"],
    ["Dashboard", "Visão geral"],
  ];
  for (const [menu, titulo] of telas) {
    await irPara(page, menu);
    await expect(page.getByRole("heading", { name: titulo, level: 1 })).toBeVisible();
  }
  await irPara(page, "Produtos");
  await page.getByRole("button", { name: "Novo produto" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // As fontes (Lora e Inter) vêm do próprio site; font-src 'self' não pode bloqueá-las.
  const fontes = await page.evaluate(async () => {
    await document.fonts.ready;
    const carregadas: string[] = [];
    document.fonts.forEach((f) => {
      if (f.status === "loaded") carregadas.push(f.family.replace(/"/g, ""));
    });
    return carregadas;
  });
  expect(fontes).toContain("Inter Variable");
  expect(fontes).toContain("Lora Variable");

  const violacoes = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violacoes).toEqual([]);
});
