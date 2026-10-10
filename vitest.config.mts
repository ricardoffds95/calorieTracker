import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // server-only throws outside the Next.js server bundle; tests run in plain Node.
      "server-only": path.resolve(import.meta.dirname, "lib/test/server-only-stub.ts"),
    },
  },
  test: { environment: "node", include: ["lib/**/*.test.ts", "app/api/**/*.test.ts"] },
});
