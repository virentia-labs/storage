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

/**
 * `true` when `T` is exactly `any`. `Equal` alone cannot reject `any` in every
 * position (an `any` return is assignable both ways), so no-`any` regressions on
 * the public surface are asserted explicitly with `Assert<Equal<IsAny<T>, false>>`.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;
