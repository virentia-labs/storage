/**
 * A tiny deterministic PRNG and value generators for property-based tests.
 * There is no `Math.random`: every property runs from a fixed seed, and
 * `forAll` re-seeds per run and reports the failing seed so a counterexample
 * reproduces exactly.
 */

export type Rng = () => number;

/** mulberry32 — a small seedable PRNG returning a float in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const intBetween = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[intBetween(rng, 0, xs.length - 1)];

const STRING_CHARS = "abc XYZ 0_\"'\\{}[]:,Ω\n\t";

export function randomString(rng: Rng): string {
  const n = intBetween(rng, 0, 8);
  let s = "";
  for (let i = 0; i < n; i++) s += STRING_CHARS[intBetween(rng, 0, STRING_CHARS.length - 1)];
  return s;
}

/**
 * A value from the JSON-lossless subset: null, boolean, safe integer, finite
 * non-`-0` float, string, and bounded arrays/objects of the same. Never
 * produces undefined, NaN, Infinity, -0, bigint, function, symbol, Date, Map,
 * or Set — the values a JSON round-trip would alter.
 */
export function jsonValue(rng: Rng, depth = 0): unknown {
  if (depth >= 3 || rng() < 0.6) {
    switch (intBetween(rng, 0, 4)) {
      case 0:
        return null;
      case 1:
        return rng() < 0.5;
      case 2:
        return intBetween(rng, -1_000_000, 1_000_000);
      case 3:
        return (rng() - 0.5) * 2000; // finite; exactly 0 is +0, never -0
      default:
        return randomString(rng);
    }
  }
  if (rng() < 0.5) {
    return Array.from({ length: intBetween(rng, 0, 4) }, () => jsonValue(rng, depth + 1));
  }
  const obj: Record<string, unknown> = {};
  const n = intBetween(rng, 0, 4);
  for (let i = 0; i < n; i++) obj[randomString(rng)] = jsonValue(rng, depth + 1);
  return obj;
}

/**
 * A JSON-lossless value that is never a bare string at the top level — the case
 * the query serializer intentionally does not round-trip (a string whose text
 * is valid JSON reads back parsed). Nested strings are unaffected.
 */
export function jsonNonStringValue(rng: Rng): unknown {
  switch (intBetween(rng, 0, 4)) {
    case 0:
      return null;
    case 1:
      return rng() < 0.5;
    case 2:
      return intBetween(rng, -1_000_000, 1_000_000);
    case 3:
      return Array.from({ length: intBetween(rng, 0, 4) }, () => jsonValue(rng, 1));
    default: {
      const obj: Record<string, unknown> = {};
      const n = intBetween(rng, 0, 4);
      for (let i = 0; i < n; i++) obj[randomString(rng)] = jsonValue(rng, 1);
      return obj;
    }
  }
}

/**
 * Run `body` over `runs` deterministic pseudo-random cases. A failure is
 * re-thrown with the failing run's seed so the exact case reproduces.
 */
export function forAll(seed: number, runs: number, body: (rng: Rng, run: number) => void): void {
  for (let run = 0; run < runs; run++) {
    const caseSeed = (seed + run) | 0;
    try {
      body(mulberry32(caseSeed), run);
    } catch (error) {
      throw new Error(
        `property failed on run ${run} (seed ${caseSeed}): ${(error as Error).message}`,
      );
    }
  }
}
