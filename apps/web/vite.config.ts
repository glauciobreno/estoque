import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Em desenvolvimento, /api é encaminhado para a API: mesma origem, sem CORS e com cookies.
const alvoApi = process.env.API_PROXY_TARGET ?? "http://localhost:3000";

// O preview (usado nos testes E2E) aplica os mesmos cabeçalhos de produção do vercel.json,
// assim uma violação da CSP aparece nos testes e não só depois do deploy.
const { headers: regrasDeCabecalho } = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const cabecalhos = Object.fromEntries(
  regrasDeCabecalho
    .find((regra) => regra.source === "/(.*)")
    ?.headers.map(({ key, value }) => [key, value]) ?? [],
);

const proxy = {
  "/api": { target: alvoApi, rewrite: (path: string) => path.replace(/^\/api/, "") },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { proxy, headers: cabecalhos },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
