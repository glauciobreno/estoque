import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import { loadConfig } from "../config.js";
import { createDb, type Db } from "./client.js";

export const pastaMigrations = fileURLToPath(new URL("../../drizzle", import.meta.url));

export function aplicarMigrations(db: Db) {
  return migrate(db, { migrationsFolder: pastaMigrations });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  await aplicarMigrations(createDb(config.databaseUrl, config.databaseAuthToken));
  console.log("Migrations aplicadas");
}
