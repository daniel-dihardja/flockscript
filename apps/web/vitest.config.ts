import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["components/editor/workers/**/*.test.ts"],
  },
});
