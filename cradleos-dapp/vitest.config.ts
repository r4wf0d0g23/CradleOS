import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Don't pick up component tests in this initial pass — we lint them separately
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
