import { describe, expect, test, vi } from "vitest";

import { memory } from "../lib";

describe("memory — storage semantics", () => {
  test("round-trips values by reference (no serialization)", () => {
    const box = memory();
    const value = { a: 1 };
    box.set("k", value);
    expect(box.get("k")).toBe(value); // identical reference
  });

  test("returns undefined for absent and removed keys", () => {
    const box = memory();
    expect(box.get("missing")).toBeUndefined();
    box.set("k", 1);
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  test("last write wins", () => {
    const box = memory();
    box.set("k", 1);
    box.set("k", 2);
    expect(box.get("k")).toBe(2);
  });

  test("null is a real value, distinct from absence", () => {
    const box = memory();
    box.set("k", null);
    expect(box.get("k")).toBeNull();
    expect(box.get("absent")).toBeUndefined();
  });

  test("stores falsy values faithfully", () => {
    const box = memory();
    for (const v of [0, "", false, NaN]) {
      box.set("k", v);
      expect(box.get("k")).toBe(v);
    }
  });

  test("seeds from a Map, an array of tuples, or nothing", () => {
    expect(memory(new Map([["k", 42]])).get("k")).toBe(42);
    expect(
      memory([
        ["a", 1],
        ["b", "x"],
      ]).get("b"),
    ).toBe("x");
    expect(memory().get("a")).toBeUndefined();
    expect(memory(undefined).get("a")).toBeUndefined();
  });

  test("empty-string key is a normal key", () => {
    const box = memory();
    box.set("", 7);
    expect(box.get("")).toBe(7);
  });
});

describe("memory — undefined is the absence sentinel", () => {
  test("set(key, undefined) removes the key", () => {
    const box = memory();
    box.set("k", 5);
    box.set("k", undefined);
    expect(box.get("k")).toBeUndefined();
  });

  test("seeding drops entries whose value is undefined", () => {
    const box = memory([
      ["a", undefined],
      ["b", 2],
    ]);
    expect(box.get("a")).toBeUndefined();
    expect(box.get("b")).toBe(2);
  });

  test("a seeded-undefined key is truly absent (removing it emits nothing)", () => {
    // `get` can't distinguish present-undefined from absent, so observe the
    // invariant through `remove`: an absent key must not fire watchers.
    const box = memory([["a", undefined]]);
    const listener = vi.fn();
    box.watch!("a", listener);
    box.remove("a");
    expect(listener).not.toHaveBeenCalled();
  });

  test("set(key, undefined) on an existing key notifies removal exactly once", () => {
    const box = memory();
    const listener = vi.fn();
    box.set("k", 1);
    box.watch!("k", listener);
    box.set("k", undefined);
    expect(listener.mock.calls).toEqual([[undefined]]);
    expect(box.get("k")).toBeUndefined();
  });

  test("set(key, undefined) on an absent key does not notify", () => {
    const box = memory();
    const listener = vi.fn();
    box.watch!("k", listener);
    box.set("k", undefined);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("memory — watch semantics", () => {
  test("listener receives exactly one argument: the new value", () => {
    const box = memory();
    const seen: unknown[][] = [];
    box.watch!("k", (...args) => seen.push(args));
    box.set("k", 9);
    expect(seen).toEqual([[9]]);
  });

  test("fires on set and remove for the watched key only", () => {
    const box = memory();
    const listener = vi.fn();
    box.watch!("k", listener);
    box.set("k", 1);
    box.set("other", 2);
    box.remove("k");
    expect(listener.mock.calls).toEqual([[1], [undefined]]);
  });

  test("remove of an absent key is a silent no-op (no spurious emit)", () => {
    const box = memory();
    const listener = vi.fn();
    box.watch!("k", listener);
    box.remove("k"); // never present
    expect(listener).not.toHaveBeenCalled();
    expect(() => box.remove("k")).not.toThrow();
  });

  test("re-setting the same value still emits (no dedup)", () => {
    const box = memory();
    const listener = vi.fn();
    box.set("k", 1);
    box.watch!("k", listener);
    box.set("k", 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("multiple listeners on one key all fire, in registration order", () => {
    const box = memory();
    const order: string[] = [];
    box.watch!("k", () => order.push("a"));
    box.watch!("k", () => order.push("b"));
    box.set("k", 1);
    expect(order).toEqual(["a", "b"]);
  });

  test("registering the same function twice de-dupes (Set semantics)", () => {
    const box = memory();
    const listener = vi.fn();
    box.watch!("k", listener);
    box.watch!("k", listener);
    box.set("k", 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("watch does not fire on registration", () => {
    const box = memory();
    box.set("k", 1);
    const listener = vi.fn();
    box.watch!("k", listener);
    expect(listener).not.toHaveBeenCalled();
  });

  test("unsubscribe detaches the listener", () => {
    const box = memory();
    const listener = vi.fn();
    const unwatch = box.watch!("k", listener);
    unwatch();
    box.set("k", 1);
    expect(listener).not.toHaveBeenCalled();
  });

  test("unsubscribe is idempotent", () => {
    const box = memory();
    const listener = vi.fn();
    const unwatch = box.watch!("k", listener);
    unwatch();
    expect(() => unwatch()).not.toThrow();
    box.set("k", 1);
    expect(listener).not.toHaveBeenCalled();
  });

  // The bug that motivated the set-identity guard: a stale unsubscribe from an
  // emptied-and-recreated key must not evict a newer subscription.
  test("a stale unsubscribe never evicts a sibling subscription on the same key", () => {
    const box = memory();
    const a = vi.fn();
    const b = vi.fn();

    const unA = box.watch!("k", a); // Set1 = {a}
    unA(); // Set1 empties -> listeners['k'] deleted
    box.watch!("k", b); // recreate listeners['k'] = Set2 = {b}
    unA(); // STALE: must NOT delete Set2

    box.set("k", 1);
    expect(b).toHaveBeenCalledWith(1); // b still live
  });

  test("a listener that throws does not break siblings or the writer", () => {
    const box = memory();
    const after = vi.fn();
    box.watch!("k", () => {
      throw new Error("boom");
    });
    box.watch!("k", after);

    expect(() => box.set("k", 1)).not.toThrow(); // writer is shielded
    expect(after).toHaveBeenCalledWith(1); // sibling still fires
  });

  test("watch on one key is independent of writes to another", () => {
    const box = memory();
    const listener = vi.fn();
    box.watch!("a", listener);
    box.set("b", 1);
    box.remove("b");
    expect(listener).not.toHaveBeenCalled();
  });

  test("each memory() box is isolated", () => {
    const one = memory();
    const two = memory();
    one.set("k", 1);
    expect(two.get("k")).toBeUndefined();
  });
});
