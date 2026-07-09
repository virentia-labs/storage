import { describe, expect, it } from "vitest";

import type { CustomStorage } from "../../lib";
import { custom } from "../../lib";
import { mapBackend } from "../support/map-backend";

describe("custom", () => {
  it("forwards each call to the backend in order, once each", () => {
    const backend = mapBackend();
    const box = custom(backend);
    box.set("a", 1);
    box.get("a");
    box.remove("a");
    expect(backend.calls).toEqual(["set:a", "get:a", "remove:a"]);
  });

  it("reads back the value written through it", () => {
    const box = custom(mapBackend());
    box.set("k", 1);
    expect(box.get("k")).toBe(1);
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  it("passes a non-serializable value through the backend unchanged", () => {
    const box = custom(mapBackend());
    const value = Symbol("v");
    box.set("k", value);
    expect(box.get("k")).toBe(value);
  });

  it("passes a non-string key through the backend unchanged", () => {
    const box = custom(mapBackend());
    const numericKey = 42 as unknown as string;
    box.set(numericKey, "v");
    expect(box.get(numericKey)).toBe("v");
  });

  it("delegates set(key, undefined) to the backend as a remove", () => {
    const backend = mapBackend();
    const box = custom(backend);
    box.set("k", 1);
    backend.calls.length = 0;
    box.set("k", undefined); // the absence sentinel: never a literal set(k, undefined)
    expect(backend.calls).toEqual(["remove:k"]);
    expect(box.get("k")).toBeUndefined();
  });

  it("holds no shadow state, so every read reaches the backend", () => {
    const backend = mapBackend();
    const box = custom(backend);
    box.set("k", 1);
    box.get("k");
    box.get("k");
    expect(backend.calls.filter((c) => c === "get:k")).toHaveLength(2);
  });

  it("late-binds the backend method on each call", () => {
    const backend = mapBackend();
    const box = custom(backend);
    backend.get = () => "late";
    expect(box.get("anything")).toBe("late");
  });

  it("returns a distinct box from each call", () => {
    const backend = mapBackend();
    expect(custom(backend)).not.toBe(custom(backend));
  });

  it("exposes only get, set, remove, and watch, never the backend's extras", () => {
    const backend = { ...mapBackend(), extra: () => "leak", secret: 1 };
    const box = custom(backend as unknown as CustomStorage);
    expect(Object.keys(box).sort()).toEqual(["get", "remove", "set", "watch"]);
    expect((box as unknown as Record<string, unknown>).extra).toBeUndefined();
    expect((box as unknown as Record<string, unknown>).secret).toBeUndefined();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("throws at construction when the backend is %s", (_label, backend) => {
    expect(() => custom(backend as unknown as CustomStorage)).toThrow();
  });
});
