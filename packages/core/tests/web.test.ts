// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";

import { local, session } from "../lib";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe.each([
  ["local", local, () => window.localStorage],
  ["session", session, () => window.sessionStorage],
] as const)("%s", (_name, factory, area) => {
  test("serializes values as JSON strings", () => {
    const box = factory();

    box.set("user", { name: "Ada" });

    expect(area().getItem("user")).toBe('{"name":"Ada"}');
    expect(box.get("user")).toEqual({ name: "Ada" });
  });

  test("returns undefined for absent keys and after removal", () => {
    const box = factory();

    expect(box.get("missing")).toBeUndefined();

    box.set("k", 1);
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  test("tolerates malformed stored JSON", () => {
    const box = factory();
    area().setItem("k", "{not json");

    expect(box.get("k")).toBeUndefined();
  });
});

describe("local watch", () => {
  test("reacts to cross-document storage events", () => {
    const box = local();
    const listener = vi.fn();

    const unwatch = box.watch!("token", listener);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "token",
        newValue: '"abc"',
        storageArea: window.localStorage,
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "token",
        newValue: null,
        storageArea: window.localStorage,
      }),
    );

    expect(listener.mock.calls).toEqual([["abc"], [undefined]]);

    unwatch();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "token",
        newValue: '"z"',
        storageArea: window.localStorage,
      }),
    );
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("ignores events for other keys and areas", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "other",
        newValue: "1",
        storageArea: window.localStorage,
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "token",
        newValue: "1",
        storageArea: window.sessionStorage,
      }),
    );

    expect(listener).not.toHaveBeenCalled();
  });
});
