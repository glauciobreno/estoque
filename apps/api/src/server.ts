import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";

const config = loadConfig();
const app = await buildApp({ db: createDb(config.databaseUrl, config.databaseAuthToken), config });
await app.listen({ port: config.port, host: "0.0.0.0" });
