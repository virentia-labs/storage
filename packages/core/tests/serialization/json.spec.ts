import { describe, expect, it } from "vitest";

import { jsonSerializer } from "../../lib";

describe("jsonSerializer", () => {
  describe("write", () => {
    it("stringifies a plain object in insertion order", () => {
      expect(jsonSerializer.write({ name: "Ada", age: 36 })).toBe('{"name":"Ada","age":36}');
    });

    it("returns the value undefined, not a string, for undefined", () => {
      expect(jsonSerializer.write(undefined)).toBeUndefined();
    });

    it.each([
      ["a function", () => 1],
      ["a symbol", Symbol("x")],
    ])("returns undefined for a top-level %s", (_label, value) => {
      expect(jsonSerializer.write(value)).toBeUndefined();
    });

    it.each([
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["-Infinity", -Infinity],
    ])("yields the string 'null' for %s", (_label, value) => {
      expect(jsonSerializer.write(value)).toBe("null");
    });

    it("omits object properties JSON cannot represent", () => {
      expect(jsonSerializer.write({ a: undefined, b: 1, c: () => {}, d: Symbol() })).toBe(
        '{"b":1}',
      );
    });

    it("maps unrepresentable array elements to null", () => {
      expect(jsonSerializer.write([undefined, () => {}, Symbol("x"), 5])).toBe(
        "[null,null,null,5]",
      );
    });

    it("maps array holes to null", () => {
      const holes: number[] = [1];
      holes[2] = 3; // index 1 is a genuine hole
      expect(jsonSerializer.write(holes)).toBe("[1,null,3]");
    });

    it("serializes a Date to an ISO string", () => {
      expect(jsonSerializer.write(new Date("2020-01-01T00:00:00.000Z"))).toBe(
        '"2020-01-01T00:00:00.000Z"',
      );
    });

    it("honors a custom toJSON", () => {
      expect(jsonSerializer.write({ toJSON: () => ({ x: 1 }) })).toBe('{"x":1}');
    });

    it.each([
      ["a Map", new Map([["a", 1]])],
      ["a Set", new Set([1, 2])],
    ])("loses the entries of %s", (_label, value) => {
      expect(jsonSerializer.write(value)).toBe("{}");
    });

    it.each([
      ["a bigint", 10n],
      ["a bigint object property", { n: 10n }],
    ])("throws a TypeError for %s", (_label, value) => {
      expect(() => jsonSerializer.write(value)).toThrow(TypeError);
    });

    it("throws for a circular structure", () => {
      const a: Record<string, unknown> = {};
      a.self = a;
      expect(() => jsonSerializer.write(a)).toThrow(TypeError);
    });

    it('collapses the sign of -0 to "0"', () => {
      expect(jsonSerializer.write(-0)).toBe("0");
    });
  });

  describe("read", () => {
    it.each([
      ["the empty string", ""],
      ["the literal 'undefined'", "undefined"],
      ["malformed JSON", "{not json"],
      ["a non-canonical number literal", "007"],
      ["a leading byte-order mark", "﻿42"],
    ])("throws on %s", (_label, raw) => {
      expect(() => jsonSerializer.read(raw)).toThrow();
    });

    it("tolerates surrounding whitespace", () => {
      expect(jsonSerializer.read("  42  ")).toBe(42);
    });

    it("yields Infinity for '1e999', which write can never emit", () => {
      expect(jsonSerializer.read("1e999")).toBe(Infinity);
    });

    it("loses precision on a huge integer literal", () => {
      expect(jsonSerializer.read("100000000000000000001")).toBe(1e20);
    });

    it("keeps the last of duplicate object keys", () => {
      expect(jsonSerializer.read('{"a":1,"a":2}')).toEqual({ a: 2 });
    });

    it("does not rebuild a Date from an ISO string", () => {
      const back = jsonSerializer.read('"2020-01-01T00:00:00.000Z"');
      expect(back).toBe("2020-01-01T00:00:00.000Z");
      expect(back instanceof Date).toBe(false);
    });

    it("does not pollute Object.prototype through a __proto__ key", () => {
      const parsed = jsonSerializer.read('{"__proto__":{"polluted":true}}') as Record<
        string,
        unknown
      >;
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    });

    it("reads a literal -0 back as -0", () => {
      expect(Object.is(jsonSerializer.read("-0"), -0)).toBe(true);
    });

    it("reads a literal 0 back as +0", () => {
      expect(Object.is(jsonSerializer.read("0"), 0)).toBe(true);
    });
  });

  describe("round-trip", () => {
    it("preserves every JSON-representable value", () => {
      for (const value of [null, true, false, 0, -1, 3.14, "hi", [1, 2, 3], { a: [1, { b: 2 }] }]) {
        expect(jsonSerializer.read(jsonSerializer.write(value))).toEqual(value);
      }
    });

    it("preserves the empty string through the token '\"\"'", () => {
      const raw = jsonSerializer.write("");
      expect(raw).toBe('""');
      expect(jsonSerializer.read(raw)).toBe("");
    });

    it("is lossless for multi-byte unicode and emoji", () => {
      const value = { msg: "héllo 🌱 café", nested: ["Ω", "𝕏"] };
      expect(jsonSerializer.read(jsonSerializer.write(value))).toEqual(value);
    });

    it("double-encodes a string whose text is itself JSON", () => {
      expect(jsonSerializer.write("[1,2]")).toBe('"[1,2]"');
      expect(jsonSerializer.read(jsonSerializer.write("[1,2]"))).toBe("[1,2]");
    });
  });

  it("is deterministic: equal input yields byte-identical output", () => {
    expect(jsonSerializer.write({ a: 1 })).toBe(jsonSerializer.write({ a: 1 }));
  });
});
