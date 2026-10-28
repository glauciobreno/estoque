import { expect, test as setup } from "@playwright/test";
import { ADMIN, OPERADOR, SESSAO_ADMIN, SESSAO_OPERADOR } from "./usuarios";

for (const [usuario, arquivo] of [
  [ADMIN, SESSAO_ADMIN],
  [OPERADOR, SESSAO_OPERADOR],
] as const) {
  setup(`autentica ${usuario.papel}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(usuario.email);
    await page.getByLabel("Senha").fill(usuario.senha);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.context().storageState({ path: arquivo });
  });
}
