import { describe, expect, test, vi } from "vitest";

import { custom } from "../lib";

describe("custom", () => {
  test("delegates to the supplied backend", () => {
    const backend = new Map<string, unknown>();
    const box = custom({
      get: (key) => backend.get(key),
      set: (key, value) => void backend.set(key, value),
      remove: (key) => void backend.delete(key),
    });

    box.set("k", 1);
    expect(box.get("k")).toBe(1);

    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  test("omits watch when the backend has none", () => {
    const box = custom({ get: () => undefined, set: () => {}, remove: () => {} });

    expect(box.watch).toBeUndefined();
  });

  test("forwards watch when the backend provides it", () => {
    const unwatch = vi.fn();
    const watch = vi.fn(() => unwatch);
    const box = custom({ get: () => undefined, set: () => {}, remove: () => {}, watch });

    const listener = () => {};
    const returned = box.watch!("k", listener);

    expect(watch).toHaveBeenCalledWith("k", listener);
    expect(returned).toBe(unwatch);
  });
});
