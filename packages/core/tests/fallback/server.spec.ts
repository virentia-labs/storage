// @vitest-environment node
import { describe, expect, it } from "vitest";

import { local, query, session } from "../../lib";

// In a pure Node environment there is no `window`, `localStorage`, or
// `sessionStorage`. Every DOM-backed box must degrade to an in-memory box so
// the same model code runs unchanged on the server.
describe.each([
  ["local", local],
  ["session", session],
  ["query", query],
])("%s falls back to memory outside the browser", (_name, factory) => {
  it("constructs without throwing", () => {
    expect(() => factory()).not.toThrow();
  });

  it("stores by reference, without serializing", () => {
    const box = factory();
    const value = { a: 1 };
    box.set("k", value);
    expect(box.get("k")).toBe(value); // identical reference => memory, not JSON/URL
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  it("exposes a working watch that fires on same-process writes", () => {
    const box = factory();
    const seen: unknown[] = [];
    box.watch!("k", (v) => seen.push(v));
    box.set("k", 1);
    expect(seen).toEqual([1]);
  });

  it("does not share state between instances", () => {
    const a = factory();
    const b = factory();
    a.set("k", 1);
    expect(b.get("k")).toBeUndefined();
  });
});
