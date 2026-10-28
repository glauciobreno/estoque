import { expect, test } from "@playwright/test";
import { SESSAO_OPERADOR } from "./usuarios";

test.use({ storageState: SESSAO_OPERADOR });

test.describe("operador", () => {
  test("vê os cadastros, mas sem ações de edição", async ({ page }) => {
    await page.goto("/produtos");
    await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo produto" })).toHaveCount(0);

    await page.goto("/categorias");
    await expect(page.getByRole("heading", { name: "Categorias" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova categoria" })).toHaveCount(0);

    await page.goto("/fornecedores");
    await expect(page.getByRole("button", { name: "Novo fornecedor" })).toHaveCount(0);
  });

  test("consegue abrir o formulário de movimentação", async ({ page }) => {
    await page.goto("/movimentacoes");
    await page.getByRole("button", { name: "Nova movimentação" }).click();
    await expect(page.getByRole("dialog").getByLabel("Tipo")).toBeVisible();
  });

  test("a API recusa escrita em cadastros mesmo fora da interface", async ({ page }) => {
    await page.goto("/");
    const leitura = await page.request.get("/api/produtos");
    expect(leitura.status()).toBe(200);

    const escrita = await page.request.post("/api/categorias", { data: { nome: "Invasora" } });
    expect(escrita.status()).toBe(403);
    expect(await escrita.json()).toEqual({ erro: "Sem permissão" });
  });

  test("a API recusa escrita vinda de outra origem", async ({ page }) => {
    await page.goto("/");
    const res = await page.request.post("/api/movimentacoes", {
      headers: { origin: "https://site-malicioso.example" },
      data: { tipo: "entrada", produtoId: 1, quantidade: 1 },
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ erro: "Origem não permitida" });
  });
});
