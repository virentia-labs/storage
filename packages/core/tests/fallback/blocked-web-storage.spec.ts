// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { local } from "../../lib";

afterEach(() => {
  vi.unstubAllGlobals(); // restore real storage BEFORE touching it
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("web storage falls back to memory when it is unavailable", () => {
  it("uses memory when globalThis.localStorage is missing (SSR)", () => {
    vi.stubGlobal("localStorage", undefined);
    const box = local();
    const value = { a: 1 };
    box.set("k", value);
    expect(box.get("k")).toBe(value); // reference semantics => memory, not JSON
  });

  it("uses memory when setItem throws (private mode), without touching storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    const box = local();
    expect(() => box.set("k", { a: 1 })).not.toThrow();
    expect(box.get("k")).toEqual({ a: 1 });
  });

  it("isolates each fallback box", () => {
    vi.stubGlobal("localStorage", undefined);
    const a = local();
    const b = local();
    a.set("k", 1);
    expect(b.get("k")).toBeUndefined();
  });

  it("uses memory when accessing localStorage throws (sandboxed iframe)", () => {
    // A Proxy whose property access throws mimics a Storage that cannot be used;
    // the probe's first touch throws and is caught, so the box falls back.
    vi.stubGlobal(
      "localStorage",
      new Proxy(
        {},
        {
          get() {
            throw new Error("SecurityError");
          },
        },
      ),
    );
    const box = local();
    const value = { a: 1 };
    box.set("k", value);
    expect(box.get("k")).toBe(value);
  });

  it("exposes no watch when a working Storage lacks window.addEventListener", () => {
    const backing = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    });
    const original = window.addEventListener;
    Object.defineProperty(window, "addEventListener", { value: undefined, configurable: true });
    try {
      const box = local();
      expect(box.watch).toBeUndefined(); // canWatch === false
      box.set("k", { a: 1 });
      expect(backing.get("k")).toBe('{"a":1}'); // real (stubbed) Storage path, JSON-encoded
      expect(box.get("k")).toEqual({ a: 1 });
    } finally {
      Object.defineProperty(window, "addEventListener", { value: original, configurable: true });
    }
  });
});
