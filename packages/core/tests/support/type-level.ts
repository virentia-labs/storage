/**
 * Type-level assertion helpers, shared by the `types/*.spec-d.ts` suites.
 *
 * `Equal` is an exact-equality check (not structural assignability): it
 * distinguishes `any` from `unknown` and a wider type from a narrower one, so
 * an assertion cannot pass on a type that is merely compatible. A failed
 * `Equal` makes `Assert` un-instantiable, which `tsc` reports as an error.
 * `Extends` is the deliberately weaker assignability check, used only where a
 * one-way relationship (variance) is the property under test.
 */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export type Assert<_T extends true> = void;
export type Extends<A, B> = A extends B ? true : false;
