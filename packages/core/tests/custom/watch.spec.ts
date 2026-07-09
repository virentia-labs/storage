import { describe, expect, it, vi } from "vitest";

import type { CustomStorage } from "../../lib";
import { custom } from "../../lib";
import { mapBackend } from "../support/map-backend";

describe("custom watch", () => {
  it("is absent when the backend has no watch", () => {
    const box = custom(mapBackend());
    expect(box.watch).toBeUndefined();
  });

  it("is absent when the backend's watch is a truthy non-function", () => {
    const backend = { ...mapBackend(), watch: 42 as unknown as CustomStorage["watch"] };
    expect(custom(backend).watch).toBeUndefined();
  });

  it("forwards the key and listener and returns the backend's unsubscribe", () => {
    const unwatch = vi.fn();
    const watch = vi.fn(() => unwatch);
    const box = custom({ ...mapBackend(), watch });
    const listener = () => {};
    const returned = box.watch!("k", listener);
    expect(watch).toHaveBeenCalledWith("k", listener);
    expect(returned).toBe(unwatch);
  });

  it("delegates to the backend on every call, without memoizing", () => {
    const backendWatch = vi.fn(() => () => {});
    const box = custom({ ...mapBackend(), watch: backendWatch });
    box.watch!("k", () => {});
    box.watch!("k", () => {});
    expect(backendWatch).toHaveBeenCalledTimes(2);
  });

  it("reads the backend's watch exactly once, at construction", () => {
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

  it("late-binds the backend watch, throwing if it is removed after construction", () => {
    const backend: CustomStorage = { ...mapBackend(), watch: () => () => {} };
    const box = custom(backend);
    delete backend.watch; // present at construction, gone at call time
    expect(() => box.watch!("k", () => {})).toThrow();
  });
});
