import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORTA_API = 3100;
const PORTA_WEB = 5273;
const BANCO = resolve("e2e/.tmp/e2e.db");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORTA_WEB}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Permite usar um Chromium já instalado (ex.: ambientes sem acesso ao download do Playwright).
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  // Sempre sobe servidores novos e um banco zerado, para os testes não dependerem de execuções anteriores.
  webServer: [
    {
      command: "npx tsx e2e/prepare-db.ts && npm run start -w @estoque/api",
      url: `http://localhost:${PORTA_API}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "test",
        PORT: String(PORTA_API),
        E2E_DB_FILE: BANCO,
        TURSO_DATABASE_URL: `file:${BANCO}`,
        JWT_SECRET: "segredo-somente-para-testes-e2e-0123456789",
        CORS_ORIGIN: `http://localhost:${PORTA_WEB}`,
        RATE_LIMIT_LOGIN_MAX: "1000",
      },
    },
    {
      command: `npm run build -w @estoque/web && npm run preview -w @estoque/web -- --port ${PORTA_WEB} --strictPort`,
      url: `http://localhost:${PORTA_WEB}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PROXY_TARGET: `http://localhost:${PORTA_API}` },
    },
  ],
});
