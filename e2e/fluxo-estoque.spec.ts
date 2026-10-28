import { expect, test, type Page } from "@playwright/test";
import { SESSAO_ADMIN } from "./usuarios";

test.use({ storageState: SESSAO_ADMIN });
test.describe.configure({ mode: "serial" });

const sufixo = Date.now().toString(36).toUpperCase();
const categoria = `Cat ${sufixo}`;
const fornecedor = `Forn ${sufixo}`;
const sku = `E2E-${sufixo}`;
const nome = `Produto ${sufixo}`;

const dialogo = (page: Page) => page.getByRole("dialog");
const linha = (page: Page) => page.getByRole("row").filter({ hasText: sku });

async function buscar(page: Page) {
  await page.goto("/produtos");
  await page.getByLabel("Buscar produtos").fill(sku);
  await expect(linha(page)).toBeVisible();
}

async function movimentar(
  page: Page,
  {
    tipo,
    valor,
    motivo,
    fornecedor: forn,
  }: { tipo: "entrada" | "saida" | "ajuste"; valor: number; motivo?: string; fornecedor?: string },
) {
  await linha(page).getByRole("button", { name: "Movimentar" }).click();
  await dialogo(page).getByLabel("Tipo").selectOption(tipo);
  await dialogo(page)
    .getByLabel(tipo === "ajuste" ? "Saldo contado" : "Quantidade")
    .fill(String(valor));
  if (forn) await dialogo(page).getByLabel("Fornecedor (opcional)").selectOption({ label: forn });
  if (motivo)
    await dialogo(page)
      .getByLabel(/^Motivo/)
      .fill(motivo);
  await dialogo(page).getByRole("button", { name: "Registrar" }).click();
}

test("cadastra categoria e fornecedor", async ({ page }) => {
  await page.goto("/categorias");
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await dialogo(page).getByLabel("Nome").fill(categoria);
  await dialogo(page).getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("cell", { name: categoria })).toBeVisible();

  await page.goto("/fornecedores");
  await page.getByRole("button", { name: "Novo fornecedor" }).click();
  await dialogo(page).getByLabel("Nome").fill(fornecedor);
  await dialogo(page).getByLabel("Contato").fill("contato@e2e.test");
  await dialogo(page).getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("cell", { name: fornecedor })).toBeVisible();
});

test("cadastra um produto com saldo inicial zero", async ({ page }) => {
  await page.goto("/produtos");
  await page.getByRole("button", { name: "Novo produto" }).click();

  await dialogo(page).getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo(page).getByText("Informe o SKU")).toBeVisible();

  await dialogo(page).getByLabel("SKU").fill(sku);
  await dialogo(page).getByLabel("Nome").fill(nome);
  await dialogo(page).getByLabel("Categoria").selectOption({ label: categoria });
  await dialogo(page).getByLabel("Preço de custo (R$)").fill("12,50");
  await dialogo(page).getByLabel("Preço de venda (R$)").fill("19,90");
  await dialogo(page).getByLabel("Estoque mínimo").fill("0");
  await dialogo(page).getByRole("button", { name: "Salvar" }).click();

  await buscar(page);
  await expect(linha(page)).toContainText(nome);
  await expect(linha(page)).toContainText("0 un");
  await expect(linha(page)).toContainText("R$ 19,90");
});

test("recusa SKU duplicado", async ({ page }) => {
  await page.goto("/produtos");
  await page.getByRole("button", { name: "Novo produto" }).click();
  await dialogo(page).getByLabel("SKU").fill(sku);
  await dialogo(page).getByLabel("Nome").fill("Outro");
  await dialogo(page).getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo(page).getByRole("alert")).toHaveText("Já existe um produto com esse SKU");
});

test("registra uma entrada e atualiza o saldo", async ({ page }) => {
  await buscar(page);
  await movimentar(page, { tipo: "entrada", valor: 20, fornecedor, motivo: "compra inicial" });
  await expect(dialogo(page)).toBeHidden();
  await expect(linha(page)).toContainText("20 un");
});

test("registra uma saída e atualiza o saldo", async ({ page }) => {
  await buscar(page);
  await movimentar(page, { tipo: "saida", valor: 5 });
  await expect(linha(page)).toContainText("15 un");
});

test("bloqueia saída maior que o saldo e mantém o saldo", async ({ page }) => {
  await buscar(page);
  await movimentar(page, { tipo: "saida", valor: 100 });
  await expect(dialogo(page).getByRole("alert")).toHaveText("Saldo insuficiente: disponível 15");
  await dialogo(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(linha(page)).toContainText("15 un");
});

test("ajuste exige motivo e leva o saldo ao valor contado", async ({ page }) => {
  await buscar(page);
  await movimentar(page, { tipo: "ajuste", valor: 12 });
  await expect(dialogo(page).getByText("Informe o motivo do ajuste")).toBeVisible();

  await dialogo(page).getByLabel("Motivo").fill("contagem física");
  await dialogo(page).getByRole("button", { name: "Registrar" }).click();
  await expect(linha(page)).toContainText("12 un");
});

test("o detalhe do produto mostra o histórico completo", async ({ page }) => {
  await buscar(page);
  await linha(page).getByRole("link", { name: nome }).click();
  await expect(page.getByRole("heading", { name: nome })).toBeVisible();

  const historico = page.locator("tbody tr");
  await expect(historico).toHaveCount(3);
  await expect(historico.nth(0)).toContainText("Ajuste");
  await expect(historico.nth(0)).toContainText("-3");
  await expect(historico.nth(1)).toContainText("Saída");
  await expect(historico.nth(1)).toContainText("-5");
  await expect(historico.nth(2)).toContainText("Entrada");
  await expect(historico.nth(2)).toContainText("+20");
  await expect(historico.nth(2)).toContainText("compra inicial");
});

test("produto com movimentações não pode ser excluído", async ({ page }) => {
  await buscar(page);
  await linha(page).getByRole("button", { name: "Excluir" }).click();
  await dialogo(page).getByRole("button", { name: "Excluir" }).click();
  await expect(dialogo(page).getByRole("alert")).toContainText("possui movimentações");
  await dialogo(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(linha(page)).toBeVisible();
});

test("produto no estoque mínimo aparece no alerta do dashboard", async ({ page }) => {
  await buscar(page);
  await linha(page).getByRole("button", { name: "Editar" }).click();
  await dialogo(page).getByLabel("Estoque mínimo").fill("12");
  await dialogo(page).getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo(page)).toBeHidden();

  await page.goto("/");
  const painel = page.locator("section").filter({ hasText: "Estoque baixo" });
  await expect(painel.getByRole("link", { name: nome })).toBeVisible();

  await page.goto("/produtos?abaixo=true");
  await page.getByLabel("Buscar produtos").fill(sku);
  await expect(linha(page)).toBeVisible();
});

test("o histórico geral filtra por tipo", async ({ page }) => {
  await page.goto("/movimentacoes");
  await page.getByLabel("Tipo").selectOption("saida");
  await expect(page.getByRole("row").filter({ hasText: nome })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "Entrada" })).toHaveCount(0);
});
