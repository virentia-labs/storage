import { describe, expect, test, vi } from "vitest";

import { custom, type CustomStorage } from "../lib";

function mapBackend(): CustomStorage & { calls: string[] } {
  const store = new Map<string, unknown>();
  const calls: string[] = [];
  return {
    calls,
    get(key) {
      calls.push(`get:${key}`);
      return store.get(key);
    },
    set(key, value) {
      calls.push(`set:${key}`);
      store.set(key, value);
    },
    remove(key) {
      calls.push(`remove:${key}`);
      store.delete(key);
    },
  };
}

describe("custom", () => {
  test("delegates get/set/remove to the backend", () => {
    const box = custom(mapBackend());
    box.set("k", 1);
    expect(box.get("k")).toBe(1);
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  test("calls map 1:1 onto the backend, in order, once each", () => {
    const backend = mapBackend();
    const box = custom(backend);
    box.set("a", 1);
    box.get("a");
    box.remove("a");
    expect(backend.calls).toEqual(["set:a", "get:a", "remove:a"]);
  });

  test("passes a non-serializable value and a non-string key through unchanged", () => {
    const backend = mapBackend();
    const box = custom(backend);
    const sym = Symbol("v");
    const numericKey = 42 as unknown as string; // exercise a genuinely non-string key
    box.set(numericKey, sym);
    expect(box.get(numericKey)).toBe(sym);
  });

  test("enforces the absence sentinel: set(key, undefined) is delegated as remove", () => {
    const backend = mapBackend();
    const box = custom(backend);
    box.set("k", 1);
    backend.calls.length = 0;
    box.set("k", undefined); // must become remove, never set(k, undefined)
    expect(backend.calls).toEqual(["remove:k"]);
    expect(box.get("k")).toBeUndefined();
  });

  test("holds no shadow state — every get hits the backend", () => {
    const backend = mapBackend();
    const box = custom(backend);
    box.set("k", 1);
    box.get("k");
    box.get("k");
    expect(backend.calls.filter((c) => c === "get:k")).toHaveLength(2);
  });

  test("late-binds the backend: reassigning backend.get is honored", () => {
    const backend = mapBackend();
    const box = custom(backend);
    backend.get = () => "late";
    expect(box.get("anything")).toBe("late");
  });

  test("each custom() call yields a distinct box instance", () => {
    const backend = mapBackend();
    expect(custom(backend)).not.toBe(custom(backend));
  });

  test("exposes only get/set/remove/watch — no backend extras leak", () => {
    const backend = { ...mapBackend(), extra: () => "leak", secret: 1 };
    const box = custom(backend as unknown as CustomStorage);
    expect(Object.keys(box).sort()).toEqual(["get", "remove", "set", "watch"]);
    expect((box as unknown as Record<string, unknown>).extra).toBeUndefined();
    expect((box as unknown as Record<string, unknown>).secret).toBeUndefined();
  });
});

describe("custom — watch", () => {
  test("forwards watch and its unsubscribe when the backend provides one", () => {
    const unwatch = vi.fn();
    const watch = vi.fn(() => unwatch);
    const box = custom({ ...mapBackend(), watch });
    const listener = () => {};
    const returned = box.watch!("k", listener);
    expect(watch).toHaveBeenCalledWith("k", listener);
    expect(returned).toBe(unwatch);
  });

  test("omits watch when the backend has none", () => {
    const box = custom(mapBackend());
    expect(box.watch).toBeUndefined();
  });

  test("treats a truthy non-function watch as absent (guard is typeof, not truthiness)", () => {
    const backend = { ...mapBackend(), watch: 42 as unknown as CustomStorage["watch"] };
    const box = custom(backend);
    expect(box.watch).toBeUndefined();
  });

  test("watch presence is snapshotted at construction (reads backend.watch once)", () => {
    const backend = mapBackend();
    let reads = 0;
    Object.defineProperty(backend, "watch", {
      configurable: true,
      get() {
        reads += 1;
        return undefined;
      },
    });
    custom(backend);
    expect(reads).toBe(1);
  });

  test("watch target is late-bound: present-then-deleted throws on call", () => {
    const backend: CustomStorage = { ...mapBackend(), watch: () => () => {} };
    const box = custom(backend);
    delete backend.watch; // present at construction, gone at call time
    expect(() => box.watch!("k", () => {})).toThrow();
  });

  test("invoking watch delegates to the backend every time (no memoization)", () => {
    const backendWatch = vi.fn(() => () => {});
    const box = custom({ ...mapBackend(), watch: backendWatch });
    box.watch!("k", () => {});
    box.watch!("k", () => {});
    expect(backendWatch).toHaveBeenCalledTimes(2);
  });
});

describe("custom — construction", () => {
  test("throws when handed null or undefined (reads .watch at construction)", () => {
    expect(() => custom(null as unknown as CustomStorage)).toThrow();
    expect(() => custom(undefined as unknown as CustomStorage)).toThrow();
  });
});
