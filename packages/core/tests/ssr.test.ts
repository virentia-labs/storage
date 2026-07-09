// @vitest-environment node
import { describe, expect, test } from "vitest";

import { local, query, session } from "../lib";

// In a pure Node environment there is no `window`, `localStorage`, or
// `sessionStorage`. Every DOM-backed box must degrade to an in-memory box so
// the same model code runs unchanged on the server.
describe.each([
  ["local", local],
  ["session", session],
  ["query", query],
])("%s falls back to memory outside the browser", (_name, factory) => {
  test("constructs without throwing", () => {
    expect(() => factory()).not.toThrow();
  });

  test("behaves as an in-memory box (reference semantics, no serialization)", () => {
    const box = factory();
    const value = { a: 1 };
    box.set("k", value);
    expect(box.get("k")).toBe(value); // identical reference => memory, not JSON/URL
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  test("watch is present (the memory fallback) and fires on same-process writes", () => {
    const box = factory();
    const seen: unknown[] = [];
    box.watch!("k", (v) => seen.push(v));
    box.set("k", 1);
    expect(seen).toEqual([1]);
  });

  test("fallback boxes do not share state", () => {
    const a = factory();
    const b = factory();
    a.set("k", 1);
    expect(b.get("k")).toBeUndefined();
  });
});
