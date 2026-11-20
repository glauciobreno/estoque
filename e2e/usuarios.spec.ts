import { expect, test, type Browser, type Page } from "@playwright/test";
import { SESSAO_ADMIN } from "./usuarios";

test.use({ storageState: SESSAO_ADMIN });
test.describe.configure({ mode: "serial" });

const sufixo = Date.now().toString(36);
const nome = `Carla ${sufixo}`;
const email = `carla.${sufixo}@e2e.test`;
const SENHA_1 = "primeira-senha-123";
const SENHA_2 = "segunda-senha-4567";
let link = "";

const linha = (page: Page) => page.getByRole("row").filter({ hasText: email });

async function novaPessoa(browser: Browser) {
  const baseURL = test.info().project.use.baseURL;
  // Sessão vazia: sem isso o contexto herdaria o storageState do administrador definido em test.use.
  const contexto = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  return { contexto, page: await contexto.newPage() };
}

async function entrar(page: Page, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("o administrador cadastra só nome e e-mail e recebe o link de primeiro acesso", async ({
  page,
}) => {
  await page.goto("/usuarios");
  await page.getByRole("button", { name: "Novo usuário" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByLabel(/senha/i)).toHaveCount(0);

  await dialogo.getByLabel("Nome").fill(nome);
  await dialogo.getByLabel("E-mail").fill(email);
  await dialogo.getByRole("button", { name: "Criar e gerar link" }).click();

  const modalLink = page.getByRole("dialog", { name: "Link de primeiro acesso" });
  link = await modalLink.getByLabel("Link de acesso").inputValue();
  expect(link).toMatch(/\/ativar#[\w-]{40,}$/);
  await expect(modalLink).toContainText("só funciona uma vez");
  await modalLink.getByRole("button", { name: "Fechar" }).last().click();

  await expect(linha(page)).toContainText("Aguardando primeiro acesso");
  await expect(linha(page)).toContainText("Operador");
});

test("antes de definir a senha, a pessoa não consegue entrar", async ({ browser }) => {
  const { contexto, page } = await novaPessoa(browser);
  await entrar(page, "qualquer-senha-123");
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos");
  await contexto.close();
});

test("a pessoa abre o link, escolhe a senha e já entra como operador", async ({ browser }) => {
  const { contexto, page } = await novaPessoa(browser);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: `Bem-vindo(a), ${nome}` })).toBeVisible();
  await expect(page).toHaveURL(/\/ativar$/); // o token sai da barra de endereço

  await page.getByLabel("Senha", { exact: true }).fill("curta");
  await page.getByLabel("Confirmar senha").fill("curta");
  await page.getByRole("button", { name: "Definir senha e entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("pelo menos 10 caracteres");

  await page.getByLabel("Senha", { exact: true }).fill(SENHA_1);
  await page.getByLabel("Confirmar senha").fill("diferente-da-senha-1");
  await page.getByRole("button", { name: "Definir senha e entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("não conferem");

  await page.getByLabel("Confirmar senha").fill(SENHA_1);
  await page.getByRole("button", { name: "Definir senha e entrar" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);

  await page.goto("/usuarios"); // operador não acessa a administração
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  expect((await page.request.get("/api/usuarios")).status()).toBe(403);
  await contexto.close();
});

test("o link só funciona uma vez", async ({ browser }) => {
  const { contexto, page } = await novaPessoa(browser);
  await page.goto(link);
  await expect(page.getByRole("alert")).toContainText("inválido ou expirou");
  await contexto.close();
});

test("a pessoa entra normalmente com a senha escolhida e vê a situação atualizada", async ({
  browser,
  page,
}) => {
  const pessoa = await novaPessoa(browser);
  await entrar(pessoa.page, SENHA_1);
  await expect(pessoa.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await pessoa.contexto.close();

  await page.goto("/usuarios");
  await expect(linha(page)).toContainText("Ativo");
});

test("desativar tira o acesso na hora, e reativar devolve", async ({ browser, page }) => {
  const pessoa = await novaPessoa(browser);
  await entrar(pessoa.page, SENHA_1);
  await expect(pessoa.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/usuarios");
  await linha(page).getByRole("button", { name: "Desativar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desativar" }).click();
  await expect(linha(page)).toContainText("Inativo");

  // a sessão que já estava aberta cai na primeira ação, sem esperar o token expirar
  await pessoa.page.getByRole("link", { name: "Categorias" }).click();
  await expect(pessoa.page).toHaveURL(/\/login$/);
  await expect(pessoa.page.getByRole("status")).toContainText("Sua sessão expirou");
  await entrar(pessoa.page, SENHA_1);
  await expect(pessoa.page.getByRole("alert")).toHaveText("E-mail ou senha inválidos");

  await linha(page).getByRole("button", { name: "Reativar" }).click();
  await expect(linha(page)).toContainText("Ativo");
  // reativar não ressuscita a sessão antiga: a pessoa precisa entrar de novo
  await pessoa.page.goto("/");
  await expect(pessoa.page).toHaveURL(/\/login$/);
  await entrar(pessoa.page, SENHA_1);
  await expect(pessoa.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await pessoa.contexto.close();
});

test("redefinir a senha: o link troca a senha e a antiga deixa de valer", async ({
  browser,
  page,
}) => {
  await page.goto("/usuarios");
  await linha(page).getByRole("button", { name: "Redefinir senha" }).click();
  const modal = page.getByRole("dialog", { name: "Link para redefinir a senha" });
  const linkNovo = await modal.getByLabel("Link de acesso").inputValue();
  await modal.getByRole("button", { name: "Fechar" }).last().click();

  const pessoa = await novaPessoa(browser);
  await entrar(pessoa.page, SENHA_1); // a senha atual vale até o link ser usado
  await expect(pessoa.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await pessoa.contexto.close();

  const outra = await novaPessoa(browser);
  await outra.page.goto(linkNovo);
  await expect(outra.page.getByRole("heading", { name: "Redefinir senha" })).toBeVisible();
  await outra.page.getByLabel("Senha", { exact: true }).fill(SENHA_2);
  await outra.page.getByLabel("Confirmar senha").fill(SENHA_2);
  await outra.page.getByRole("button", { name: "Definir senha e entrar" }).click();
  await expect(outra.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await outra.contexto.close();

  const conferir = await novaPessoa(browser);
  await entrar(conferir.page, SENHA_1);
  await expect(conferir.page.getByRole("alert")).toHaveText("E-mail ou senha inválidos");
  await entrar(conferir.page, SENHA_2);
  await expect(conferir.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await conferir.contexto.close();
});

test("o administrador altera a própria senha e não consegue se desativar", async ({ page }) => {
  await page.goto("/usuarios");
  const minhaLinha = page.getByRole("row").filter({ hasText: "(você)" });
  await expect(minhaLinha).toBeVisible();
  await expect(minhaLinha.getByRole("button", { name: "Desativar" })).toHaveCount(0);

  await page.getByRole("button", { name: "Alterar senha" }).click();
  const dialogo = page.getByRole("dialog", { name: "Alterar senha" });
  await dialogo.getByLabel("Senha atual").fill("senha-errada-123");
  await dialogo.getByLabel("Nova senha", { exact: true }).fill("nova-senha-do-admin");
  await dialogo.getByLabel("Confirmar nova senha").fill("nova-senha-do-admin");
  await dialogo.getByRole("button", { name: "Alterar senha" }).click();
  await expect(dialogo.getByRole("alert")).toHaveText("Senha atual incorreta");
});
