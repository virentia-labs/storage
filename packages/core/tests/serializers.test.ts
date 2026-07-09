import { describe, expect, test } from "vitest";

import { jsonSerializer, querySerializer } from "../lib";

describe("jsonSerializer", () => {
  test("round-trips JSON-representable values to a deep-equal value", () => {
    for (const value of [null, true, false, 0, -1, 3.14, "hi", [1, 2, 3], { a: [1, { b: 2 }] }]) {
      expect(jsonSerializer.read(jsonSerializer.write(value))).toEqual(value);
    }
  });

  test("write of a plain object emits insertion-order JSON", () => {
    expect(jsonSerializer.write({ name: "Ada", age: 36 })).toBe('{"name":"Ada","age":36}');
  });

  test("empty string round-trips", () => {
    const raw = jsonSerializer.write("");
    expect(raw).toBe('""');
    expect(jsonSerializer.read(raw)).toBe("");
  });

  // ── corner: values JSON cannot represent ──────────────────────────────────
  test("write(undefined) returns the JS value undefined, not a string", () => {
    expect(jsonSerializer.write(undefined)).toBeUndefined();
  });

  test("write of a top-level function or symbol returns undefined", () => {
    expect(jsonSerializer.write(() => 1)).toBeUndefined();
    expect(jsonSerializer.write(Symbol("x"))).toBeUndefined();
  });

  test("write(NaN/Infinity/-Infinity) yields the string 'null'", () => {
    expect(jsonSerializer.write(NaN)).toBe("null");
    expect(jsonSerializer.write(Infinity)).toBe("null");
    expect(jsonSerializer.write(-Infinity)).toBe("null");
  });

  test("write drops undefined/function/symbol object properties", () => {
    expect(jsonSerializer.write({ a: undefined, b: 1, c: () => {}, d: Symbol() })).toBe('{"b":1}');
  });

  test("write maps undefined/function/symbol array elements and holes to null", () => {
    expect(jsonSerializer.write([undefined, () => {}, Symbol("x"), 5])).toBe("[null,null,null,5]");
    const holes: number[] = [1];
    holes[2] = 3; // index 1 is a genuine hole
    expect(jsonSerializer.write(holes)).toBe("[1,null,3]");
  });

  test("write(Date) yields an ISO string; read does not rebuild a Date", () => {
    const raw = jsonSerializer.write(new Date("2020-01-01T00:00:00.000Z"));
    expect(raw).toBe('"2020-01-01T00:00:00.000Z"');
    const back = jsonSerializer.read(raw);
    expect(back).toBe("2020-01-01T00:00:00.000Z");
    expect(back instanceof Date).toBe(false);
  });

  test("write honors a custom toJSON", () => {
    expect(jsonSerializer.write({ toJSON: () => ({ x: 1 }) })).toBe('{"x":1}');
  });

  test("write(Map)/write(Set) silently lose entries", () => {
    expect(jsonSerializer.write(new Map([["a", 1]]))).toBe("{}");
    expect(jsonSerializer.write(new Set([1, 2]))).toBe("{}");
  });

  test("write(bigint) throws TypeError", () => {
    expect(() => jsonSerializer.write(10n)).toThrow(TypeError);
    expect(() => jsonSerializer.write({ n: 10n })).toThrow(TypeError);
  });

  test("write of a circular structure throws", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => jsonSerializer.write(a)).toThrow(TypeError);
  });

  test("write(-0) collapses the sign; read yields +0", () => {
    expect(jsonSerializer.write(-0)).toBe("0");
    expect(Object.is(jsonSerializer.read("-0"), -0)).toBe(true); // literal -0 survives read
    expect(Object.is(jsonSerializer.read("0"), 0)).toBe(true);
  });

  // ── corner/wild: read ──────────────────────────────────────────────────────
  test("read('') and read of malformed JSON throw", () => {
    expect(() => jsonSerializer.read("")).toThrow();
    expect(() => jsonSerializer.read("undefined")).toThrow();
    expect(() => jsonSerializer.read("{not json")).toThrow();
    expect(() => jsonSerializer.read("007")).toThrow(); // non-canonical number literal
    expect(() => jsonSerializer.read("﻿42")).toThrow(); // leading BOM
  });

  test("read tolerates surrounding whitespace", () => {
    expect(jsonSerializer.read("  42  ")).toBe(42);
  });

  test("read('1e999') yields Infinity (an asymmetry: write can never emit it)", () => {
    expect(jsonSerializer.read("1e999")).toBe(Infinity);
  });

  test("read of a huge integer literal loses precision", () => {
    expect(jsonSerializer.read("100000000000000000001")).toBe(1e20);
  });

  test("read of duplicate object keys keeps the last", () => {
    expect(jsonSerializer.read('{"a":1,"a":2}')).toEqual({ a: 2 });
  });

  test("read of a __proto__ key does not pollute Object.prototype", () => {
    const parsed = jsonSerializer.read('{"__proto__":{"polluted":true}}') as Record<
      string,
      unknown
    >;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  test("a string that is itself JSON is double-encoded", () => {
    expect(jsonSerializer.write("[1,2]")).toBe('"[1,2]"');
    expect(jsonSerializer.read(jsonSerializer.write("[1,2]"))).toBe("[1,2]");
  });

  test("preserves unicode / emoji losslessly", () => {
    const value = { msg: "héllo 🌱 café", nested: ["Ω", "𝕏"] };
    expect(jsonSerializer.read(jsonSerializer.write(value))).toEqual(value);
  });

  test("is a stateless shared singleton (no cross-call state)", () => {
    expect(jsonSerializer.write({ a: 1 })).toBe(jsonSerializer.write({ a: 1 }));
  });
});

describe("querySerializer", () => {
  test("write returns strings verbatim and JSON-stringifies non-strings", () => {
    expect(querySerializer.write("docs")).toBe("docs");
    expect(querySerializer.write(2)).toBe("2");
    expect(querySerializer.write(true)).toBe("true");
    expect(querySerializer.write(null)).toBe("null");
    expect(querySerializer.write({ a: 1 })).toBe('{"a":1}');
    expect(querySerializer.write([1, 2])).toBe("[1,2]");
  });

  test("write(undefined/function/symbol) returns a non-string", () => {
    expect(querySerializer.write(undefined)).toBeUndefined();
    expect(querySerializer.write(() => {})).toBeUndefined();
    expect(querySerializer.write(Symbol())).toBeUndefined();
  });

  test("write(NaN/Infinity) yields 'null'", () => {
    expect(querySerializer.write(NaN)).toBe("null");
    expect(querySerializer.write(Infinity)).toBe("null");
  });

  test("read returns parsed JSON when valid, else the raw string", () => {
    expect(querySerializer.read("1e3")).toBe(1000);
    expect(querySerializer.read("true")).toBe(true);
    expect(querySerializer.read("false")).toBe(false);
    expect(querySerializer.read("null")).toBeNull();
    expect(querySerializer.read('{"a":1}')).toEqual({ a: 1 });
    expect(querySerializer.read("-5")).toBe(-5);
  });

  test("read falls back to the raw string for non-JSON text", () => {
    expect(querySerializer.read("docs")).toBe("docs");
    expect(querySerializer.read("")).toBe(""); // empty string is invalid JSON
    expect(querySerializer.read("007")).toBe("007");
    expect(querySerializer.read("Infinity")).toBe("Infinity");
    expect(querySerializer.read("NaN")).toBe("NaN");
    expect(querySerializer.read("undefined")).toBe("undefined");
    expect(querySerializer.read("a b&c")).toBe("a b&c");
  });

  test("round-trips every non-string JSON value", () => {
    for (const value of [0, -1, 3.14, true, false, null, [1, 2], { a: { b: 2 } }]) {
      expect(querySerializer.read(querySerializer.write(value))).toEqual(value);
    }
  });

  test("does NOT round-trip strings whose text is itself valid JSON (type confusion)", () => {
    expect(querySerializer.read(querySerializer.write("2"))).toBe(2); // string -> number
    expect(querySerializer.read(querySerializer.write("true"))).toBe(true); // string -> boolean
    expect(querySerializer.read(querySerializer.write("null"))).toBeNull(); // string -> null
    expect(querySerializer.read(querySerializer.write("[1,2]"))).toEqual([1, 2]); // string -> array
  });
});
