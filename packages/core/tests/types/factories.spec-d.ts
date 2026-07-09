/**
 * Type-level suite for the box factories and their options — validated by
 * `tsc`, excluded from the vitest runtime by its `.spec-d.ts` suffix.
 */
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
  type QueryBoxOptions,
  type Serializer,
  type StorageBox,
  type StringBoxOptions,
} from "../../lib";
import type { Assert, Equal, Extends, IsAny } from "../support/type-level";

// ── factory return + serializer + parameter types ────────────────────────────
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

// no factory returns `any` (an `any` return would pass the Equal checks above).
type _NAf1 = Assert<Equal<IsAny<ReturnType<typeof memory>>, false>>;
type _NAf2 = Assert<Equal<IsAny<ReturnType<typeof local>>, false>>;
type _NAf3 = Assert<Equal<IsAny<ReturnType<typeof custom>>, false>>;

// ── assignability of concrete serializers ────────────────────────────────────
type _P34b = Assert<Extends<typeof jsonSerializer, Serializer>>;
type _P34c = Assert<Extends<typeof querySerializer, Serializer>>;
const _serOpt: StringBoxOptions["serializer"] = jsonSerializer;
const _serOpt2: QueryBoxOptions["serializer"] = querySerializer;
// a plain user literal is a Serializer and usable as an option.
const userSerializer = { read: (r: string) => r, write: (v: unknown) => String(v) };
const _p35a: Serializer = userSerializer;
local({ serializer: userSerializer });

// ── accepted argument forms ──────────────────────────────────────────────────
memory();
memory(undefined);
memory(new Map<string, unknown>());
memory(new Map<string, number>());
memory([
  ["a", 1],
  ["b", "x"],
]);
memory(new Map([["a", 1]]));
local();
local({});
local({ serializer: jsonSerializer });
session({ serializer: querySerializer });
query();
query({});
query({ history: "push" });
query({ history: "replace" });
query({ serializer: querySerializer, history: "push" });
custom({ get: () => undefined, set: () => {}, remove: () => {} });
custom({ get: () => undefined, set: () => {}, remove: () => {}, watch: () => () => {} });

// ── every named export resolves with its type ────────────────────────────────
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

// ── option / argument type violations ────────────────────────────────────────
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
