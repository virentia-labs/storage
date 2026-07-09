import { describe, expect, it } from "vitest";

import type { StorageBox } from "../../lib";
import { custom, memory } from "../../lib";
import { forAll, intBetween, jsonValue, pick } from "../support/arbitrary";

const freshCustom = (): StorageBox => {
  const backing = new Map<string, unknown>();
  return custom({
    get: (k) => backing.get(k),
    set: (k, v) => void backing.set(k, v),
    remove: (k) => void backing.delete(k),
  });
};

// A box with reference semantics must behave exactly as a `Map` in which
// `undefined` means "absent" — over any sequence of set/remove/get commands.
describe.each([
  ["memory", () => memory()],
  ["custom", freshCustom],
])("%s behaves as a Map with undefined-as-absence (property)", (_name, make) => {
  it("matches a reference model over a random command sequence", () => {
    forAll(0xda7a5e7, 300, (rng) => {
      const box = make();
      const model = new Map<string, unknown>();
      const keys = ["a", "b", "c", "", "k1"] as const;

      const steps = intBetween(rng, 1, 40);
      for (let step = 0; step < steps; step++) {
        const key = pick(rng, keys);
        switch (intBetween(rng, 0, 2)) {
          case 0: {
            const value = rng() < 0.15 ? undefined : jsonValue(rng);
            box.set(key, value);
            if (value === undefined) model.delete(key);
            else model.set(key, value);
            break;
          }
          case 1:
            box.remove(key);
            model.delete(key);
            break;
          // case 2 leaves state unchanged and only reads below.
        }
        for (const k of keys) {
          expect(box.get(k)).toEqual(model.has(k) ? model.get(k) : undefined);
        }
      }
    });
  });
});
