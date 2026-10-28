import { expect, test } from "@playwright/test";
import { SESSAO_ADMIN } from "./usuarios";

test.use({ storageState: SESSAO_ADMIN });

test("as telas funcionam sob a CSP de produção, sem violações", async ({ page }) => {
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

  for (const tela of ["Produtos", "Movimentações", "Categorias", "Fornecedores", "Dashboard"]) {
    await page.getByRole("link", { name: tela }).click();
    await expect(page.getByRole("heading", { name: tela })).toBeVisible();
  }
  await page.getByRole("link", { name: "Produtos" }).click();
  await page.getByRole("button", { name: "Novo produto" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const violacoes = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violacoes).toEqual([]);
});
