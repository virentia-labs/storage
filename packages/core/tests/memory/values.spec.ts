import { describe, expect, it } from "vitest";

import { memory } from "../../lib";

describe("memory", () => {
  it("round-trips a value by reference, without serializing", () => {
    const box = memory();
    const value = { a: 1 };
    box.set("k", value);
    expect(box.get("k")).toBe(value); // the identical reference
  });

  it("returns undefined for an absent key and after a remove", () => {
    const box = memory();
    expect(box.get("missing")).toBeUndefined();
    box.set("k", 1);
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  it("keeps only the last write to a key", () => {
    const box = memory();
    box.set("k", 1);
    box.set("k", 2);
    expect(box.get("k")).toBe(2);
  });

  it("stores null as a real value", () => {
    const box = memory();
    box.set("k", null);
    expect(box.get("k")).toBeNull();
  });

  it("stores every falsy value faithfully", () => {
    const box = memory();
    for (const value of [0, "", false, NaN]) {
      box.set("k", value);
      expect(box.get("k")).toBe(value);
    }
  });

  it("treats an empty string as an ordinary key", () => {
    const box = memory();
    box.set("", 7);
    expect(box.get("")).toBe(7);
  });

  it("removes a key when it is set to undefined", () => {
    const box = memory();
    box.set("k", 5);
    box.set("k", undefined);
    expect(box.get("k")).toBeUndefined();
  });

  it("isolates each instance", () => {
    const one = memory();
    const two = memory();
    one.set("k", 1);
    expect(two.get("k")).toBeUndefined();
  });

  describe("seeding", () => {
    it("seeds from a Map", () => {
      expect(memory(new Map([["k", 42]])).get("k")).toBe(42);
    });

    it("seeds from an array of tuples", () => {
      expect(
        memory([
          ["a", 1],
          ["b", "x"],
        ]).get("b"),
      ).toBe("x");
    });

    it("treats a missing argument as empty", () => {
      expect(memory().get("a")).toBeUndefined();
    });

    it("treats an explicit undefined argument as empty", () => {
      expect(memory(undefined).get("a")).toBeUndefined();
    });

    it("drops entries whose seeded value is undefined", () => {
      const box = memory([
        ["a", undefined],
        ["b", 2],
      ]);
      expect(box.get("a")).toBeUndefined();
      expect(box.get("b")).toBe(2);
    });
  });
});
