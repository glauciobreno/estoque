import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Em desenvolvimento, /api é encaminhado para a API: mesma origem, sem CORS e com cookies.
const alvoApi = process.env.API_PROXY_TARGET ?? "http://localhost:3000";

const proxy = {
  "/api": { target: alvoApi, rewrite: (path: string) => path.replace(/^\/api/, "") },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { proxy },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
