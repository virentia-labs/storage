// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Serializer } from "../../lib";
import { query } from "../../lib";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(() => window.history.replaceState(null, "", "/"));

describe("query params", () => {
  it("writes a param to the URL and reads it back", () => {
    const box = query();
    box.set("q", "docs");
    expect(window.location.search).toBe("?q=docs");
    expect(box.get("q")).toBe("docs");
  });

  it("reads undefined for an absent key", () => {
    expect(query().get("missing")).toBeUndefined();
  });

  it("round-trips a number, coercing it back on read", () => {
    const box = query();
    box.set("page", 2);
    expect(window.location.search).toBe("?page=2");
    expect(box.get("page")).toBe(2);
  });

  it("keeps sibling params when one is removed", () => {
    const box = query();
    box.set("q", "docs");
    box.set("page", 2);
    box.remove("q");
    expect(box.get("q")).toBeUndefined();
    expect(box.get("page")).toBe(2);
  });

  it("drops the '?' when the last param is removed", () => {
    const box = query();
    box.set("q", "docs");
    box.remove("q");
    expect(window.location.search).toBe("");
  });

  it("round-trips an empty-string value as ?key=", () => {
    const box = query();
    box.set("q", "");
    expect(window.location.search).toBe("?q=");
    expect(box.get("q")).toBe("");
  });

  it("round-trips special characters and unicode", () => {
    const box = query();
    for (const value of ["a b&c=?#x", "100%", "héllo 🌱", "line\nbreak", "a+b"]) {
      box.set("v", value);
      expect(box.get("v")).toBe(value);
    }
  });

  it("stores an object as JSON and reads it back", () => {
    const box = query();
    box.set("f", { a: 1, b: [2, 3] });
    expect(box.get("f")).toEqual({ a: 1, b: [2, 3] });
  });

  describe("absence sentinel", () => {
    it("drops the param when a key is set to undefined", () => {
      const box = query();
      box.set("q", "x");
      box.set("q", undefined);
      expect(window.location.search).toBe("");
      expect(box.get("q")).toBeUndefined();
    });

    it("drops the param when a key is set to an unencodable value", () => {
      const box = query();
      box.set("q", "x");
      box.set("q", () => {});
      expect(box.get("q")).toBeUndefined();
    });

    it("serializes NaN to null", () => {
      const box = query();
      box.set("k", NaN);
      expect(box.get("k")).toBeNull();
    });

    it("throws when a key is set to a bigint", () => {
      expect(() => query().set("k", 10n)).toThrow();
    });
  });

  describe("reading an externally set URL", () => {
    it.each([
      ["1e3", 1000],
      ["true", true],
      ["null", null],
      ["-5", -5],
      ["007", "007"],
      ["Infinity", "Infinity"],
      ["NaN", "NaN"],
      ["hello", "hello"],
    ])("reads ?k=%s back as %o", (raw, expected) => {
      window.history.replaceState(null, "", `/?k=${raw}`);
      expect(query().get("k")).toEqual(expected);
    });

    it("returns undefined when the serializer throws on read", () => {
      const throwing: Serializer = {
        write: (v) => String(v),
        read: () => {
          throw new Error("bad");
        },
      };
      window.history.replaceState(null, "", "/?k=x");
      expect(query({ serializer: throwing }).get("k")).toBeUndefined();
    });
  });
});
