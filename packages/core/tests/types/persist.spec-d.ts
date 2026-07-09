/**
 * Type-level suite for `persist` — validated by `tsc`, excluded from the vitest
 * runtime by its `.spec-d.ts` suffix.
 */
import {
  computed,
  reactive,
  store,
  type Scope,
  type Store,
  type StoreWritable,
} from "@virentia/core";

import { memory, persist, type PersistOptions, type StorageBox } from "../../lib";
import type { Assert, Equal, Extends } from "../support/type-level";

const box = memory();

// ── PersistOptions<T> shape + persist signature ──────────────────────────────
type _P13 = Assert<
  Equal<
    PersistOptions<number>,
    {
      source: StoreWritable<number>;
      key: string;
      storage: StorageBox;
      scope?: Scope;
      serialize?: (value: number) => unknown;
      deserialize?: (raw: unknown) => number;
    }
  >
>;
type _P14 = Assert<Equal<PersistOptions<number>["source"], StoreWritable<number>>>;
type _P15 = Assert<Equal<PersistOptions<number>["key"], string>>;
type _P16 = Assert<Equal<PersistOptions<number>["storage"], StorageBox>>;
type _P17 = Assert<Equal<PersistOptions<number>["scope"], Scope | undefined>>;
type _P18 = Assert<
  Equal<PersistOptions<number>["serialize"], ((value: number) => unknown) | undefined>
>;
type _P19 = Assert<
  Equal<PersistOptions<number>["deserialize"], ((raw: unknown) => number) | undefined>
>;
type _P20 = Assert<Equal<ReturnType<typeof persist<number>>, () => void>>;
type _P34a = Assert<Extends<StoreWritable<number>, PersistOptions<number>["source"]>>;

// ── generic inference through persist ────────────────────────────────────────
// T inferred = number; return () => void.
const _p28: () => void = persist({ source: store(0), key: "k", storage: box });
// serialize `value` is number, deserialize `raw` is unknown returning number.
persist({
  source: store(0),
  key: "k",
  storage: box,
  serialize: (value) => {
    type _ = Assert<Equal<typeof value, number>>;
    return value;
  },
  deserialize: (raw) => {
    type _ = Assert<Equal<typeof raw, unknown>>;
    return Number(raw);
  },
});
// element type propagates.
persist({
  source: store("x"),
  key: "k",
  storage: box,
  serialize: (value) => {
    type _ = Assert<Equal<typeof value, string>>;
    return value;
  },
});
persist({
  source: store({ a: 1 }),
  key: "k",
  storage: box,
  serialize: (value) => {
    type _ = Assert<Equal<typeof value, { a: number }>>;
    return value;
  },
});
// serialize MAY return any type (return position is unknown).
persist({ source: store(0), key: "k", storage: box, serialize: (v) => v.toString() });
persist({ source: store(0), key: "k", storage: box, serialize: (v) => ({ wrapped: v }) });
// scope optional (missing-scope is a runtime throw, not a type error).
persist({ source: store(0), key: "k", storage: box });
// explicit type argument.
const _p33: () => void = persist<{ a: number }>({
  source: store({ a: 1 }),
  key: "k",
  storage: box,
});

// ── only a WRITABLE store is accepted as `source` ────────────────────────────
// @ts-expect-error N1 — computed() is a read-only Store.
persist({ source: computed(() => 0), key: "k", storage: box });
// @ts-expect-error N2 — .map() is read-only.
persist({ source: store(0).map((x) => x + 1), key: "k", storage: box });
// @ts-expect-error N3 — .filter() is read-only.
persist({ source: store(0).filter((x) => x > 0), key: "k", storage: box });
// @ts-expect-error N4 — .filterMap() is read-only.
persist({ source: store(0).filterMap((x) => x, -1), key: "k", storage: box });
declare const readOnly: Store<number>;
// @ts-expect-error N5 — a plain read-only Store is not StoreWritable.
persist({ source: readOnly, key: "k", storage: box });
// @ts-expect-error N6 — reactive() has no `.value`.
persist({ source: reactive({ count: 0 }), key: "k", storage: box });

// ── persist option type mismatches ───────────────────────────────────────────
// @ts-expect-error N8 — deserialize must return T=number.
persist<number>({ source: store(0), key: "k", storage: box, deserialize: (): string => "x" });
// @ts-expect-error N9 — serialize param is T=number, not string.
persist<number>({ source: store(0), key: "k", storage: box, serialize: (v: string) => v });
persist<number>({
  source: store(0),
  key: "k",
  storage: box,
  // @ts-expect-error N10 — deserialize param must accept unknown, not narrow to string.
  deserialize: (raw: string) => raw.length,
});
// @ts-expect-error N11 — key must be a string.
persist<number>({ source: store(0), key: 123, storage: box });
// @ts-expect-error N12 — {} is not a StorageBox.
persist<number>({ source: store(0), key: "k", storage: {} });
// @ts-expect-error N13 — {} is not a Scope.
persist<number>({ source: store(0), key: "k", storage: box, scope: {} });
// @ts-expect-error N14 — `source` is required.
persist<number>({ key: "k", storage: box });
// @ts-expect-error N15 — `storage` is required.
persist<number>({ source: store(0), key: "k" });
// @ts-expect-error N16 — excess property.
persist<number>({ source: store(0), key: "k", storage: box, extra: 1 });
// @ts-expect-error N17 — StoreWritable<string> is not StoreWritable<number>.
persist<number>({ source: store("x"), key: "k", storage: box });
