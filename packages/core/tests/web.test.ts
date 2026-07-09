// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { local, session, type Serializer } from "../lib";

afterEach(() => {
  vi.unstubAllGlobals(); // restore real storage before touching it
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe.each([
  ["local", local, () => window.localStorage] as const,
  ["session", session, () => window.sessionStorage] as const,
])("%s — real Web Storage", (_name, factory, area) => {
  test("serializes values as JSON strings and reads them back", () => {
    const box = factory();
    box.set("user", { name: "Ada" });
    expect(area().getItem("user")).toBe('{"name":"Ada"}');
    expect(box.get("user")).toEqual({ name: "Ada" });
  });

  test("get returns undefined for absent keys and after removal", () => {
    const box = factory();
    expect(box.get("missing")).toBeUndefined();
    box.set("k", 1);
    box.remove("k");
    expect(box.get("k")).toBeUndefined();
  });

  test("tolerates malformed and empty stored strings by returning undefined", () => {
    const box = factory();
    area().setItem("bad", "{not json");
    area().setItem("empty", "");
    expect(box.get("bad")).toBeUndefined();
    expect(box.get("empty")).toBeUndefined();
  });

  test("a raw 'null' string decodes to null (a real value)", () => {
    const box = factory();
    area().setItem("k", "null");
    expect(box.get("k")).toBeNull();
  });

  test("a string value is stored quoted and preserved as a string", () => {
    const box = factory();
    box.set("k", "hello");
    expect(area().getItem("k")).toBe('"hello"');
    expect(box.get("k")).toBe("hello");
  });

  test("empty string round-trips", () => {
    const box = factory();
    box.set("k", "");
    expect(box.get("k")).toBe("");
  });

  test("overwrite keeps only the latest value", () => {
    const box = factory();
    box.set("k", 1);
    box.set("k", 2);
    expect(box.get("k")).toBe(2);
  });

  test("unicode / emoji keys and values round-trip", () => {
    const box = factory();
    box.set("ключ🌱", { msg: "héllo 🌱" });
    expect(box.get("ключ🌱")).toEqual({ msg: "héllo 🌱" });
  });

  // ── undefined is the absence sentinel: set(undefined) removes the key ───────
  test("set(key, undefined) removes the key rather than storing 'undefined'", () => {
    const box = factory();
    box.set("k", 1);
    box.set("k", undefined);
    expect(area().getItem("k")).toBeNull(); // NOT the literal string "undefined"
    expect(box.get("k")).toBeUndefined();
  });

  test("set of a function or symbol removes the key (non-string encoding)", () => {
    const box = factory();
    box.set("k", 1);
    box.set("k", () => {});
    expect(box.get("k")).toBeUndefined();
    box.set("k", 1);
    box.set("k", Symbol("x"));
    expect(box.get("k")).toBeUndefined();
  });

  // ── JSON lossiness ─────────────────────────────────────────────────────────
  test("NaN and Infinity serialize to null", () => {
    const box = factory();
    box.set("k", NaN);
    expect(box.get("k")).toBeNull();
    box.set("k", Infinity);
    expect(box.get("k")).toBeNull();
  });

  test("Date is stored as an ISO string and read back as a string", () => {
    const box = factory();
    box.set("k", new Date("2020-01-01T00:00:00.000Z"));
    expect(box.get("k")).toBe("2020-01-01T00:00:00.000Z");
  });

  test("a bigint or circular value throws out of set (JSON limits)", () => {
    const box = factory();
    expect(() => box.set("k", 10n)).toThrow();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => box.set("k", circular)).toThrow();
  });

  test("a custom serializer overrides encoding", () => {
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

describe("web — probe leaves storage clean", () => {
  test("no probe residue after construction", () => {
    local();
    expect(window.localStorage.getItem("__virentia_storage_probe__")).toBeNull();
  });

  test("probe removes any pre-existing value at the probe key", () => {
    window.localStorage.setItem("__virentia_storage_probe__", "user-data");
    local();
    expect(window.localStorage.getItem("__virentia_storage_probe__")).toBeNull();
  });
});

describe("local — cross-document watch", () => {
  const evt = (init: StorageEventInit) => new StorageEvent("storage", init);

  // Track and remove every window listener a box registers, so no handler
  // leaks onto the shared jsdom window across tests.
  const spyAdd = () => vi.spyOn(window, "addEventListener");
  let addSpy: ReturnType<typeof spyAdd>;
  beforeEach(() => {
    addSpy = spyAdd();
  });
  afterEach(() => {
    for (const [type, handler] of addSpy.mock.calls) {
      window.removeEventListener(type, handler);
    }
  });

  test("reacts to storage events for the key, decoding the payload", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);

    window.dispatchEvent(
      evt({ key: "token", newValue: '"abc"', storageArea: window.localStorage }),
    );
    window.dispatchEvent(evt({ key: "token", newValue: "42", storageArea: window.localStorage }));

    expect(listener.mock.calls).toEqual([["abc"], [42]]);
  });

  test("newValue null (removal) notifies undefined", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(evt({ key: "token", newValue: null, storageArea: window.localStorage }));
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  test("clear() — event.key null with newValue null — notifies undefined", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(evt({ key: null, newValue: null, storageArea: window.localStorage }));
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  test("ignores events for other keys and other storage areas", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(evt({ key: "other", newValue: "1", storageArea: window.localStorage }));
    window.dispatchEvent(evt({ key: "token", newValue: "1", storageArea: window.sessionStorage }));
    expect(listener).not.toHaveBeenCalled();
  });

  test("swallows malformed and empty external payloads (listener not called)", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(evt({ key: "token", newValue: "{bad", storageArea: window.localStorage }));
    window.dispatchEvent(evt({ key: "token", newValue: "", storageArea: window.localStorage }));
    expect(listener).not.toHaveBeenCalled();
  });

  test("does not fire on registration", () => {
    const listener = vi.fn();
    local().watch!("token", listener);
    expect(listener).not.toHaveBeenCalled();
  });

  test("unsubscribe detaches and is safe to call twice", () => {
    const box = local();
    const listener = vi.fn();
    const unwatch = box.watch!("token", listener);
    unwatch();
    expect(() => unwatch()).not.toThrow();
    window.dispatchEvent(evt({ key: "token", newValue: '"x"', storageArea: window.localStorage }));
    expect(listener).not.toHaveBeenCalled();
  });

  test("session watcher ignores localStorage-area events", () => {
    const box = session();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(evt({ key: "token", newValue: "1", storageArea: window.localStorage }));
    expect(listener).not.toHaveBeenCalled();
  });

  test("decodes external payloads through a custom serializer", () => {
    const base64: Serializer = {
      write: (v) => Buffer.from(JSON.stringify(v)).toString("base64"),
      read: (r) => JSON.parse(Buffer.from(r, "base64").toString()),
    };
    const box = local({ serializer: base64 });
    const listener = vi.fn();
    box.watch!("k", listener);
    const encoded = Buffer.from(JSON.stringify({ a: 1 })).toString("base64");
    window.dispatchEvent(evt({ key: "k", newValue: encoded, storageArea: window.localStorage }));
    expect(listener).toHaveBeenCalledWith({ a: 1 });
  });
});

describe("web — fallback to memory when storage is unavailable", () => {
  test("SSR (no globalThis.localStorage) yields a working memory box", () => {
    vi.stubGlobal("localStorage", undefined);
    const box = local();
    const value = { a: 1 };
    box.set("k", value);
    expect(box.get("k")).toBe(value); // reference semantics -> memory, not JSON
  });

  test("private-mode setItem throw falls back to memory without touching storage", () => {
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

  test("fallback boxes are isolated instances", () => {
    vi.stubGlobal("localStorage", undefined);
    const a = local();
    const b = local();
    a.set("k", 1);
    expect(b.get("k")).toBeUndefined();
  });

  test("accessing localStorage that throws (sandboxed iframe) falls back to memory", () => {
    // A Proxy whose property access throws mimics a Storage that can't be used;
    // probe's first touch throws and is caught -> memory.
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
    expect(box.get("k")).toBe(value); // memory reference semantics
  });

  test("a working Storage without window.addEventListener exposes no watch", () => {
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
