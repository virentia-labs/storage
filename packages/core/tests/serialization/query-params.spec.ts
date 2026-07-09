import { describe, expect, it } from "vitest";

import { querySerializer } from "../../lib";

describe("querySerializer", () => {
  describe("write", () => {
    it("passes a string through verbatim, without quoting", () => {
      expect(querySerializer.write("docs")).toBe("docs");
    });

    it.each([
      [2, "2"],
      [true, "true"],
      [null, "null"],
      [{ a: 1 }, '{"a":1}'],
      [[1, 2], "[1,2]"],
    ])("JSON-encodes the non-string %j as %j", (value, encoded) => {
      expect(querySerializer.write(value)).toBe(encoded);
    });

    it.each([
      ["undefined", undefined],
      ["a function", () => {}],
      ["a symbol", Symbol()],
    ])("returns undefined for %s", (_label, value) => {
      expect(querySerializer.write(value)).toBeUndefined();
    });

    it.each([
      ["NaN", NaN],
      ["Infinity", Infinity],
    ])("yields 'null' for %s", (_label, value) => {
      expect(querySerializer.write(value)).toBe("null");
    });
  });

  describe("read", () => {
    it.each([
      ["1e3", 1000],
      ["true", true],
      ["false", false],
      ["null", null],
      ["-5", -5],
    ])("parses the JSON token %j as %j", (raw, parsed) => {
      expect(querySerializer.read(raw as string)).toEqual(parsed);
    });

    it("parses a JSON object token", () => {
      expect(querySerializer.read('{"a":1}')).toEqual({ a: 1 });
    });

    it.each(["docs", "", "007", "Infinity", "NaN", "undefined", "a b&c"])(
      "returns %j unchanged when it is not valid JSON",
      (raw) => {
        expect(querySerializer.read(raw)).toBe(raw);
      },
    );
  });

  describe("round-trip", () => {
    it("preserves every non-string JSON value", () => {
      for (const value of [0, -1, 3.14, true, false, null, [1, 2], { a: { b: 2 } }]) {
        expect(querySerializer.read(querySerializer.write(value))).toEqual(value);
      }
    });

    it.each([
      ["2", 2],
      ["true", true],
      ["null", null],
      ["[1,2]", [1, 2]],
    ])("reinterprets the string %j as the JSON value %j (type confusion)", (str, parsed) => {
      expect(querySerializer.read(querySerializer.write(str))).toEqual(parsed);
    });
  });
});
