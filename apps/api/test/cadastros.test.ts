import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp, login, type App } from "./helpers.js";

let app: App;
let admin: string;
let operador: string;

beforeAll(async () => {
  app = await criarApp();
  admin = (await login(app, "admin@x.com", "admin123")).cookie;
  operador = (await login(app, "op@x.com", "op12345")).cookie;
});
afterAll(() => app.close());

const req = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  cookie?: string,
  payload?: object,
) => app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

describe("permissões", () => {
  it("exige autenticação em todas as rotas de cadastro", async () => {
    for (const url of ["/categorias", "/fornecedores", "/produtos"]) {
      expect((await req("GET", url)).statusCode).toBe(401);
    }
  });

  it("operador lê, mas não escreve", async () => {
    expect((await req("GET", "/produtos", operador)).statusCode).toBe(200);
    const res = await req("POST", "/categorias", operador, { nome: "Bebidas" });
    expect(res.statusCode).toBe(403);
  });
});

describe("categorias", () => {
  it("cria, lista, atualiza e remove", async () => {
    const criada = (await req("POST", "/categorias", admin, { nome: "  Bebidas " })).json();
    expect(criada.nome).toBe("Bebidas");

    const lista = (await req("GET", "/categorias?q=beb", admin)).json();
    expect(lista).toMatchObject({ total: 1, page: 1, pageSize: 20 });

    const atualizada = await req("PUT", `/categorias/${criada.id}`, admin, { nome: "Sucos" });
    expect(atualizada.json().nome).toBe("Sucos");

    expect((await req("DELETE", `/categorias/${criada.id}`, admin)).statusCode).toBe(204);
    expect((await req("GET", `/categorias/${criada.id}`, admin)).statusCode).toBe(404);
  });

  it("recusa nome duplicado e categoria com produtos", async () => {
    const cat = (await req("POST", "/categorias", admin, { nome: "Limpeza" })).json();
    expect((await req("POST", "/categorias", admin, { nome: "Limpeza" })).statusCode).toBe(409);

    await req("POST", "/produtos", admin, { sku: "LMP-1", nome: "Sabão", categoriaId: cat.id });
    expect((await req("DELETE", `/categorias/${cat.id}`, admin)).statusCode).toBe(409);
  });
});

describe("fornecedores", () => {
  it("cria e busca por nome ou contato", async () => {
    await req("POST", "/fornecedores", admin, { nome: "Acme", contato: "acme@x.com" });
    const porContato = (await req("GET", "/fornecedores?q=acme@", admin)).json();
    expect(porContato.total).toBe(1);
  });
});

describe("produtos", () => {
  it("aplica padrões e valida os campos", async () => {
    const ok = await req("POST", "/produtos", admin, { sku: "A-1", nome: "Arroz" });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({
      unidade: "un",
      precoCusto: 0,
      saldoAtual: 0,
      estoqueMinimo: 0,
      ativo: true,
    });

    const ruim = await req("POST", "/produtos", admin, { sku: "", nome: "x", precoVenda: -1 });
    expect(ruim.statusCode).toBe(400);
  });

  it("não permite definir o saldo diretamente", async () => {
    const res = await req("POST", "/produtos", admin, { sku: "S-1", nome: "Sal", saldoAtual: 99 });
    expect(res.json().saldoAtual).toBe(0);
  });

  it("recusa SKU duplicado e categoria inexistente", async () => {
    await req("POST", "/produtos", admin, { sku: "D-1", nome: "Um" });
    expect((await req("POST", "/produtos", admin, { sku: "D-1", nome: "Dois" })).statusCode).toBe(
      409,
    );
    const res = await req("POST", "/produtos", admin, {
      sku: "D-2",
      nome: "Três",
      categoriaId: 999,
    });
    expect(res.statusCode).toBe(400);
  });

  it("atualiza e devolve 404 para id inexistente", async () => {
    const p = (await req("POST", "/produtos", admin, { sku: "U-1", nome: "Feijão" })).json();
    const up = await req("PUT", `/produtos/${p.id}`, admin, {
      sku: "U-1",
      nome: "Feijão preto",
      precoVenda: 790,
    });
    expect(up.json()).toMatchObject({ nome: "Feijão preto", precoVenda: 790 });
    expect((await req("PUT", "/produtos/9999", admin, { sku: "Z", nome: "Z" })).statusCode).toBe(
      404,
    );
  });

  it("filtra, busca e pagina", async () => {
    for (let i = 1; i <= 5; i++) {
      await req("POST", "/produtos", admin, {
        sku: `P-${i}`,
        nome: `Pagina ${i}`,
        ativo: i % 2 === 0,
      });
    }
    const pag = (await req("GET", "/produtos?q=Pagina&pageSize=2&page=2", admin)).json();
    expect(pag).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(pag.items).toHaveLength(2);

    const inativos = (await req("GET", "/produtos?q=Pagina&ativo=false", admin)).json();
    expect(inativos.total).toBe(3);
  });

  it("filtra produtos abaixo do estoque mínimo", async () => {
    await req("POST", "/produtos", admin, { sku: "M-1", nome: "Mínimo", estoqueMinimo: 5 });
    const res = (await req("GET", "/produtos?abaixoDoMinimo=true&q=Mínimo", admin)).json();
    expect(res.total).toBe(1);
  });

  it("rejeita parâmetros de listagem inválidos", async () => {
    expect((await req("GET", "/produtos?pageSize=1000", admin)).statusCode).toBe(400);
  });

  it("exclui produto sem movimentações", async () => {
    const p = (await req("POST", "/produtos", admin, { sku: "X-1", nome: "Descartável" })).json();
    expect((await req("DELETE", `/produtos/${p.id}`, admin)).statusCode).toBe(204);
  });
});
