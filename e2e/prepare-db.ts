import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { hash } from "bcryptjs";
import { createDb } from "../apps/api/src/db/client.js";
import { aplicarMigrations } from "../apps/api/src/db/migrate.js";
import { usuarios } from "../apps/api/src/db/schema.js";
import { ADMIN, OPERADOR } from "./usuarios.js";

const arquivo = process.env.E2E_DB_FILE;
if (!arquivo) throw new Error("Defina E2E_DB_FILE");

mkdirSync(dirname(arquivo), { recursive: true });
for (const sufixo of ["", "-journal", "-wal", "-shm"]) rmSync(arquivo + sufixo, { force: true });

const db = createDb(`file:${arquivo}`);
await aplicarMigrations(db);
await db.insert(usuarios).values(
  await Promise.all(
    [ADMIN, OPERADOR].map(async (u) => ({
      nome: u.nome,
      email: u.email,
      senhaHash: await hash(u.senha, 4),
      papel: u.papel,
    })),
  ),
);
console.log("Banco E2E pronto");
