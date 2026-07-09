import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    cache: false,
    include: ["tests/**/*.test.ts"],
    // The type-level suite (tests/types.test-d.ts) is validated by `tsc`
    // (`pnpm test:types` / `pnpm typecheck`), not by the vitest runtime.
  },
});
