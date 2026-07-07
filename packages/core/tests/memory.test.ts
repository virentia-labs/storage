import { describe, expect, test, vi } from "vitest";

import { memory } from "../lib";

describe("memory", () => {
  test("round-trips values by reference", () => {
    const box = memory();
    const value = { a: 1 };

    box.set("k", value);

    expect(box.get("k")).toBe(value); // same reference, no serialization
  });

  test("returns undefined for absent and removed keys", () => {
    const box = memory();

    expect(box.get("missing")).toBeUndefined();

    box.set("k", 1);
    box.remove("k");

    expect(box.get("k")).toBeUndefined();
  });

  test("seeds from an initial iterable", () => {
    const box = memory([["k", 42]]);

    expect(box.get("k")).toBe(42);
  });

  test("watch fires on same-process writes and removals for that key only", () => {
    const box = memory();
    const listener = vi.fn();

    const unwatch = box.watch!("k", listener);

    box.set("k", 1);
    box.set("other", 2);
    box.remove("k");

    expect(listener.mock.calls).toEqual([[1], [undefined]]);

    unwatch();
    box.set("k", 3);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
