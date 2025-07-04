import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/tests/**/*.ts", "src/**/*.test.ts", "src/index.ts", "src/cli.ts", "src/http-server.ts", "src/stdio.ts"],
    },
  },
});
