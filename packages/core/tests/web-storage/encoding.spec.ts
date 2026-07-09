// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import type { Serializer } from "../../lib";
import { local, session } from "../../lib";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe.each([
  ["local", local, () => window.localStorage] as const,
  ["session", session, () => window.sessionStorage] as const,
])("%s", (_name, factory, area) => {
  it("stores a value as JSON and reads it back", () => {
    const box = factory();
    box.set("user", { name: "Ada" });
    expect(area().getItem("user")).toBe('{"name":"Ada"}');
    expect(box.get("user")).toEqual({ name: "Ada" });
  });

  it("returns undefined for an absent key and after a remove", () => {
    const box = factory();
    expect(box.get("missing")).toBeUndefined();
    box.set("k", 1);
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  it("reads undefined for a malformed or empty stored string", () => {
    const box = factory();
    area().setItem("bad", "{not json");
    area().setItem("empty", "");
    expect(box.get("bad")).toBeUndefined();
    expect(box.get("empty")).toBeUndefined();
  });

  it("decodes a raw 'null' string to null", () => {
    const box = factory();
    area().setItem("k", "null");
    expect(box.get("k")).toBeNull();
  });

  it("stores a string quoted and reads it back as a string", () => {
    const box = factory();
    box.set("k", "hello");
    expect(area().getItem("k")).toBe('"hello"');
    expect(box.get("k")).toBe("hello");
  });

  it("round-trips the empty string", () => {
    const box = factory();
    box.set("k", "");
    expect(box.get("k")).toBe("");
  });

  it("keeps only the last write to a key", () => {
    const box = factory();
    box.set("k", 1);
    box.set("k", 2);
    expect(box.get("k")).toBe(2);
  });

  it("round-trips unicode and emoji keys and values", () => {
    const box = factory();
    box.set("ключ🌱", { msg: "héllo 🌱" });
    expect(box.get("ключ🌱")).toEqual({ msg: "héllo 🌱" });
  });

  it("removes a key set to undefined instead of storing the literal 'undefined'", () => {
    const box = factory();
    box.set("k", 1);
    box.set("k", undefined);
    expect(area().getItem("k")).toBeNull(); // not the string "undefined"
    expect(box.get("k")).toBeUndefined();
  });

  it.each([
    ["function", () => {}],
    ["symbol", Symbol("x")],
  ])("removes a key when set to a %s, which cannot be encoded", (_label, value) => {
    const box = factory();
    box.set("k", 1);
    box.set("k", value);
    expect(box.get("k")).toBeUndefined();
  });

  it.each([
    ["NaN", NaN],
    ["Infinity", Infinity],
  ])("reads back null for a stored %s", (_label, value) => {
    const box = factory();
    box.set("k", value);
    expect(box.get("k")).toBeNull();
  });

  it("stores a Date as an ISO string and reads it back as a string", () => {
    const box = factory();
    box.set("k", new Date("2020-01-01T00:00:00.000Z"));
    expect(box.get("k")).toBe("2020-01-01T00:00:00.000Z");
  });

  it("throws out of set for a bigint or a circular structure", () => {
    const box = factory();
    expect(() => box.set("k", 10n)).toThrow();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => box.set("k", circular)).toThrow();
  });

  it("encodes and decodes through a custom serializer", () => {
    const base64: Serializer = {
      write: (v) => Buffer.from(JSON.stringify(v)).toString("base64"),
      read: (r) => JSON.parse(Buffer.from(r, "base64").toString()),
    };
    const box = factory({ serializer: base64 });
    box.set("k", { a: 1 });
    expect(area().getItem("k")).toBe(Buffer.from('{"a":1}').toString("base64"));
    expect(box.get("k")).toEqual({ a: 1 });
  });
});
