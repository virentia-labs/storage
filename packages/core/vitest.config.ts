import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    cache: false,
    include: ["tests/**/*.spec.ts"],
    // The type-level suite (tests/types/*.spec-d.ts) is validated by `tsc`
    // (`pnpm test:types` / `pnpm typecheck`), not by the vitest runtime: its
    // `.spec-d.ts` suffix is outside the runtime glob above.
  },
});
