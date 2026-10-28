import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { loadDbConfig } from "../config.js";
import { createDb } from "./client.js";
import { usuarios } from "./schema.js";

const { ADMIN_NOME = "Administrador", ADMIN_EMAIL, ADMIN_SENHA } = process.env;
if (!ADMIN_EMAIL || !ADMIN_SENHA) {
  throw new Error("Defina ADMIN_EMAIL e ADMIN_SENHA");
}
if (ADMIN_SENHA.length < 10 || ADMIN_SENHA === "troque-esta-senha") {
  throw new Error(
    "ADMIN_SENHA deve ter pelo menos 10 caracteres e não pode ser o valor de exemplo",
  );
}

const config = loadDbConfig();
const db = createDb(config.databaseUrl, config.databaseAuthToken);
const email = ADMIN_EMAIL.toLowerCase();
const [existente] = await db.select().from(usuarios).where(eq(usuarios.email, email));

if (existente) {
  console.log("Administrador já existe");
} else {
  await db
    .insert(usuarios)
    .values({ nome: ADMIN_NOME, email, senhaHash: await hash(ADMIN_SENHA, 10), papel: "admin" });
  console.log(`Administrador ${email} criado`);
}
