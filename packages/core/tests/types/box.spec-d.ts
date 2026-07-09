/**
 * Type-level suite — validated by `tsc` (`pnpm typecheck` / `pnpm test:types`),
 * excluded from the vitest runtime by its `.spec-d.ts` suffix. A failed `Equal`
 * makes `Assert` un-instantiable; a `@ts-expect-error` that stops erroring fails
 * the compile.
 */
import {
  custom,
  type CustomStorage,
  type QueryBoxOptions,
  type Serializer,
  type StorageBox,
  type StringBoxOptions,
} from "../../lib";
import type { Assert, Equal } from "../support/type-level";

// ── exact shapes of the public interfaces ────────────────────────────────────
type _P1 = Assert<
  Equal<
    StorageBox,
    {
      get(key: string): unknown;
      set(key: string, value: unknown): void;
      remove(key: string): void;
      watch?(key: string, listener: (value: unknown) => void): () => void;
    }
  >
>;
type _P2 = Assert<Equal<StorageBox["get"], (key: string) => unknown>>;
type _P3 = Assert<Equal<StorageBox["set"], (key: string, value: unknown) => void>>;
type _P4 = Assert<Equal<StorageBox["remove"], (key: string) => void>>;
type _P5 = Assert<
  Equal<
    StorageBox["watch"],
    ((key: string, listener: (value: unknown) => void) => () => void) | undefined
  >
>;
type _P6 = Assert<Equal<Serializer, { read(raw: string): unknown; write(value: unknown): string }>>;
type _P7a = Assert<Equal<Serializer["read"], (raw: string) => unknown>>;
type _P7b = Assert<Equal<Serializer["write"], (value: unknown) => string>>;
type _P8 = Assert<Equal<StringBoxOptions, { serializer?: Serializer }>>;
type _P9 = Assert<
  Equal<QueryBoxOptions, { serializer?: Serializer; history?: "push" | "replace" }>
>;
type _P10 = Assert<Equal<QueryBoxOptions["history"], "push" | "replace" | undefined>>;
type _P11 = Assert<
  Equal<
    CustomStorage,
    {
      get(key: string): unknown;
      set(key: string, value: unknown): void;
      remove(key: string): void;
      watch?(key: string, listener: (value: unknown) => void): () => void;
    }
  >
>;
type _P12 = Assert<Equal<CustomStorage, StorageBox>>;

// ── box / serializer shape violations ────────────────────────────────────────
// @ts-expect-error N18 — `remove` missing.
const _n18: StorageBox = { get: (_k: string) => undefined, set: (_k, _v) => {} };
// @ts-expect-error N19 — get's key must be string.
const _n19: StorageBox = { get: (_k: number) => undefined, set: () => {}, remove: () => {} };
// @ts-expect-error N20 — CustomStorage requires `remove`.
custom({ get: () => undefined, set: () => {} });
// @ts-expect-error N21 — {} is not a CustomStorage.
custom({});
// @ts-expect-error N22 — write must return string.
const _n22: Serializer = { read: (r) => r, write: (_v) => 1 };
// @ts-expect-error N23 — read's param must be string.
const _n23: Serializer = { read: (_r: number) => _r, write: () => "x" };

// ── internals are not part of the public surface ─────────────────────────────
// @ts-expect-error N35 — probe is internal to web.ts.
import { probe as _probe } from "../../lib";
// @ts-expect-error N36 — createWebStorageBox is internal.
import { createWebStorageBox as _cwsb } from "../../lib";
