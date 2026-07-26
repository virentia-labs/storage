import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    cache: false,
    include: ["tests/**/*.spec.ts"],
    // The type-level suite keeps its `.spec-d.ts` suffix, which is outside the
    // runtime glob above. `vitest typecheck` picks it up only through this
    // include — its own default matches `*.test-d.ts` and would find nothing.
    // `pnpm typecheck` still covers the same files via the root tsconfig.
    typecheck: {
      include: ["tests/types/**/*.spec-d.ts"],
    },
  },
});
