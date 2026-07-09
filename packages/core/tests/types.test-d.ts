/**
 * Type-level test suite. Every assertion is validated by `tsc --noEmit`
 * (`pnpm typecheck` / `pnpm test:types`). A failed `Equal` makes `Assert`
 * un-instantiable; a `@ts-expect-error` that stops erroring fails the compile.
 * There are no runtime assertions here — this file is type-only, so the vitest
 * runtime (which globs `*.test.ts`) skips it.
 */
import {
  computed,
  reactive,
  scope,
  store,
  type Scope,
  type Store,
  type StoreWritable,
} from "@virentia/core";

import {
  custom,
  jsonSerializer,
  local,
  memory,
  persist,
  query,
  querySerializer,
  session,
  type CustomStorage,
  type PersistOptions,
  type QueryBoxOptions,
  type Serializer,
  type StorageBox,
  type StringBoxOptions,
} from "../lib";

// ── assertion helpers ────────────────────────────────────────────────────────
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<_T extends true> = void;
type Extends<A, B> = A extends B ? true : false;

const box = memory();
const numberStore = store(0);

// ── P1–P12: exact shapes of the public interfaces ────────────────────────────
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

// ── P13–P20: PersistOptions<T> shape + persist signature ──────────────────────
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

// ── P21–P27: factory + serializer + parameter types ──────────────────────────
type _P21a = Assert<Equal<ReturnType<typeof memory>, StorageBox>>;
type _P21b = Assert<Equal<ReturnType<typeof local>, StorageBox>>;
type _P21c = Assert<Equal<ReturnType<typeof session>, StorageBox>>;
type _P21d = Assert<Equal<ReturnType<typeof query>, StorageBox>>;
type _P21e = Assert<Equal<ReturnType<typeof custom>, StorageBox>>;
type _P22 = Assert<Equal<typeof jsonSerializer, Serializer>>;
type _P23 = Assert<Equal<typeof querySerializer, Serializer>>;
type _P24a = Assert<Equal<Parameters<typeof local>, [options?: StringBoxOptions]>>;
type _P24b = Assert<Equal<Parameters<typeof session>, [options?: StringBoxOptions]>>;
type _P25 = Assert<Equal<Parameters<typeof query>, [options?: QueryBoxOptions]>>;
type _P26 = Assert<Equal<Parameters<typeof custom>, [storage: CustomStorage]>>;
type _P27 = Assert<
  Equal<Parameters<typeof memory>, [initial?: Iterable<readonly [string, unknown]>]>
>;

// ── P28–P33: generic inference through persist ────────────────────────────────
// P28: T inferred = number; return () => void.
const _p28: () => void = persist({ source: store(0), key: "k", storage: box });
// P29: serialize `value` is number, deserialize `raw` is unknown returning number.
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
// P30: element type propagates.
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
// P31: serialize MAY return any type (return position is unknown).
persist({ source: store(0), key: "k", storage: box, serialize: (v) => v.toString() });
persist({ source: store(0), key: "k", storage: box, serialize: (v) => ({ wrapped: v }) });
// P32: scope optional (missing-scope is a runtime throw, not a type error).
persist({ source: store(0), key: "k", storage: box });
// P33: explicit type argument.
const _p33: () => void = persist<{ a: number }>({
  source: store({ a: 1 }),
  key: "k",
  storage: box,
});

// ── P34–P41: assignability of concrete values ────────────────────────────────
type _P34a = Assert<Extends<StoreWritable<number>, PersistOptions<number>["source"]>>;
type _P34b = Assert<Extends<typeof jsonSerializer, Serializer>>;
type _P34c = Assert<Extends<typeof querySerializer, Serializer>>;
const _serOpt: StringBoxOptions["serializer"] = jsonSerializer;
const _serOpt2: QueryBoxOptions["serializer"] = querySerializer;
// P35: a plain user literal is a Serializer and usable as an option.
const userSerializer = { read: (r: string) => r, write: (v: unknown) => String(v) };
const _p35a: Serializer = userSerializer;
local({ serializer: userSerializer });
// P37/P38: memory accepted iterables.
memory();
memory(undefined);
memory(new Map<string, unknown>());
memory(new Map<string, number>());
memory([
  ["a", 1],
  ["b", "x"],
]);
memory(new Map([["a", 1]]));
// P39: local/session accepted forms.
local();
local({});
local({ serializer: jsonSerializer });
session({ serializer: querySerializer });
// P40: query accepted forms.
query();
query({});
query({ history: "push" });
query({ history: "replace" });
query({ serializer: querySerializer, history: "push" });
// P41: custom accepted forms.
custom({ get: () => undefined, set: () => {}, remove: () => {} });
custom({ get: () => undefined, set: () => {}, remove: () => {}, watch: () => () => {} });

// ── P42: every named export resolves with its type ───────────────────────────
type _P42 = Assert<
  Equal<
    [
      typeof jsonSerializer,
      typeof querySerializer,
      typeof memory,
      typeof local,
      typeof session,
      typeof query,
      typeof custom,
      typeof persist,
    ],
    [
      Serializer,
      Serializer,
      typeof memory,
      typeof local,
      typeof session,
      typeof query,
      typeof custom,
      typeof persist,
    ]
  >
>;

// ── N1–N7: only a WRITABLE store is accepted as `source` ─────────────────────
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

// ── N8–N17: persist option type mismatches ───────────────────────────────────
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

// ── N18–N23: box / serializer shape violations ───────────────────────────────
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

// ── N24–N34: option / argument type violations ───────────────────────────────
// @ts-expect-error N24 — history is not a StringBoxOptions member.
local({ history: "push" });
// @ts-expect-error N25 — serializer must be a Serializer.
local({ serializer: 5 });
// @ts-expect-error N26 — invalid history literal.
query({ history: "pushState" });
// @ts-expect-error N27 — history is a string union, not boolean.
query({ history: true });
// @ts-expect-error N28 — local takes options, not a number.
local(5);
// @ts-expect-error N29 — number elements are not [string, unknown].
memory([1, 2, 3]);
// @ts-expect-error N30 — a string is Iterable<string>, not of tuples.
memory("abc");
// @ts-expect-error N31 — a number is not iterable.
memory(42);
// @ts-expect-error N32 — Map<number, unknown> key is not string.
memory(new Map<number, unknown>());
// @ts-expect-error N33 — [string] is missing the value element.
memory([["a"]]);
// @ts-expect-error N34 — boolean key is not string.
memory(new Map<boolean, unknown>());

// ── N35–N36: internals are not part of the public surface ────────────────────
// @ts-expect-error N35 — probe is internal to web.ts.
import { probe as _probe } from "../lib";
// @ts-expect-error N36 — createWebStorageBox is internal.
import { createWebStorageBox as _cwsb } from "../lib";

// Touch runtime values so unused-import lint stays quiet; this file runs no assertions.
export const _typeTestAnchor = [
  box,
  numberStore,
  scope,
  _p28,
  _p33,
  _serOpt,
  _serOpt2,
  _p35a,
  userSerializer,
];
