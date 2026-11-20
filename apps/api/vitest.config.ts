import { defineConfig } from "vitest/config";

// @estoque/shared: nos testes usa o código-fonte (condição "source"), sem precisar compilar.
export default defineConfig({
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"] } },
});
