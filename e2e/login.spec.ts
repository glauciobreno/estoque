import { expect, test } from "@playwright/test";
import { ADMIN } from "./usuarios";

test.describe("autenticação", () => {
  test("redireciona para o login e volta à página pedida depois de entrar", async ({ page }) => {
    await page.goto("/produtos");
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill(ADMIN.email);
    await page.getByLabel("Senha").fill(ADMIN.senha);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/produtos$/);
    await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible();
  });

  test("recusa credenciais erradas sem revelar qual campo falhou", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN.email);
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos");
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill("ninguem@e2e.test");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos");
  });

  test("sair encerra a sessão e protege as rotas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN.email);
    await page.getByLabel("Senha").fill(ADMIN.senha);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/movimentacoes");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("avisa quando a sessão expira durante o uso", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN.email);
    await page.getByLabel("Senha").fill(ADMIN.senha);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await context.clearCookies(); // simula a expiração do cookie
    await page.getByRole("link", { name: "Produtos" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("status")).toContainText("Sua sessão expirou");
  });

  test("o cookie de sessão não é acessível por JavaScript", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN.email);
    await page.getByLabel("Senha").fill(ADMIN.senha);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === "token");
    expect(cookie?.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain("token");
  });
});
