// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { query, type Serializer } from "../lib";

const spyAdd = () => vi.spyOn(window, "addEventListener");
let addSpy: ReturnType<typeof spyAdd>;
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  addSpy = spyAdd(); // track listeners to remove them after each test
});
afterEach(() => {
  for (const [type, handler] of addSpy.mock.calls) {
    window.removeEventListener(type, handler);
  }
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("query — read/write", () => {
  test("writes and reads a search param", () => {
    const box = query();
    box.set("q", "docs");
    expect(window.location.search).toBe("?q=docs");
    expect(box.get("q")).toBe("docs");
  });

  test("absent key reads undefined", () => {
    expect(query().get("missing")).toBeUndefined();
  });

  test("numbers round-trip through the default serializer", () => {
    const box = query();
    box.set("page", 2);
    expect(window.location.search).toBe("?page=2");
    expect(box.get("page")).toBe(2); // coerced back to number
  });

  test("keeps sibling params when writing and removing", () => {
    const box = query();
    box.set("q", "docs");
    box.set("page", 2);
    box.remove("q");
    expect(box.get("q")).toBeUndefined();
    expect(box.get("page")).toBe(2);
  });

  test("removing the last param drops the '?'", () => {
    const box = query();
    box.set("q", "docs");
    box.remove("q");
    expect(window.location.search).toBe("");
  });

  test("empty-string value round-trips as ?key=", () => {
    const box = query();
    box.set("q", "");
    expect(window.location.search).toBe("?q=");
    expect(box.get("q")).toBe("");
  });

  test("special characters and unicode round-trip", () => {
    const box = query();
    for (const value of ["a b&c=?#x", "100%", "héllo 🌱", "line\nbreak", "a+b"]) {
      box.set("v", value);
      expect(box.get("v")).toBe(value);
    }
  });

  test("stores objects as JSON and reads them back", () => {
    const box = query();
    box.set("f", { a: 1, b: [2, 3] });
    expect(box.get("f")).toEqual({ a: 1, b: [2, 3] });
  });
});

describe("query — undefined is the absence sentinel", () => {
  test("set(key, undefined) drops the param instead of writing ?key=undefined", () => {
    const box = query();
    box.set("q", "x");
    box.set("q", undefined);
    expect(window.location.search).toBe("");
    expect(box.get("q")).toBeUndefined();
  });

  test("set of a function or symbol drops the param", () => {
    const box = query();
    box.set("q", "x");
    box.set("q", () => {});
    expect(box.get("q")).toBeUndefined();
  });

  test("NaN serializes to null; bigint throws", () => {
    const box = query();
    box.set("k", NaN);
    expect(box.get("k")).toBeNull();
    expect(() => box.set("k", 10n)).toThrow();
  });
});

describe("query — coercion reads (external URLs)", () => {
  test.each([
    ["1e3", 1000],
    ["true", true],
    ["null", null],
    ["-5", -5],
    ["007", "007"],
    ["Infinity", "Infinity"],
    ["NaN", "NaN"],
    ["hello", "hello"],
  ])("?k=%s reads back as %o", (raw, expected) => {
    window.history.replaceState(null, "", `/?k=${raw}`);
    expect(query().get("k")).toEqual(expected);
  });
});

describe("query — history + URL construction", () => {
  test("replaces history by default (no new entry)", () => {
    const push = vi.spyOn(window.history, "pushState");
    query().set("q", "docs");
    expect(push).not.toHaveBeenCalled();
  });

  test("pushes a new entry when history:'push'", () => {
    const push = vi.spyOn(window.history, "pushState");
    query({ history: "push" }).set("q", "docs");
    expect(push).toHaveBeenCalledTimes(1);
  });

  test("passes the exact URL string to replaceState", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    query().set("q", "docs");
    expect(replace).toHaveBeenCalledWith(null, "", "/?q=docs");
  });

  test("preserves pathname, hash, and history state (replace)", () => {
    window.history.replaceState({ id: 1 }, "", "/page?x=1#sec");
    query().set("q", "docs");
    expect(window.location.pathname).toBe("/page");
    expect(window.location.hash).toBe("#sec");
    expect(window.location.search).toBe("?x=1&q=docs");
    expect(window.history.state).toEqual({ id: 1 });
  });

  test("push mode preserves URL, hash, and history state on the new entry", () => {
    window.history.replaceState({ id: 9 }, "", "/page?x=1#sec");
    const push = vi.spyOn(window.history, "pushState");
    query({ history: "push" }).set("q", "docs");
    expect(push).toHaveBeenCalledWith({ id: 9 }, "", "/page?x=1&q=docs#sec");
    expect(window.location.search).toBe("?x=1&q=docs");
    expect(window.location.hash).toBe("#sec");
    expect(window.history.state).toEqual({ id: 9 });
  });

  test("param insertion order is preserved; in-place update keeps position", () => {
    const box = query();
    box.set("a", 1);
    box.set("b", 2);
    box.set("a", 3); // update in place
    expect(window.location.search).toBe("?a=3&b=2");
  });

  test("remove of an absent key is a no-op commit", () => {
    const box = query();
    box.set("a", 1);
    box.remove("missing");
    expect(window.location.search).toBe("?a=1");
  });
});

describe("query — watch (popstate)", () => {
  const pop = () => window.dispatchEvent(new PopStateEvent("popstate"));

  test("fires with the decoded value on navigation", () => {
    const box = query();
    const listener = vi.fn();
    box.watch!("q", listener);
    window.history.replaceState(null, "", "/?q=next");
    pop();
    expect(listener).toHaveBeenCalledWith("next");
  });

  test("fires undefined when the key is gone after navigation", () => {
    const box = query();
    const listener = vi.fn();
    box.watch!("q", listener);
    window.history.replaceState(null, "", "/");
    pop();
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  test("does not fire on registration", () => {
    const listener = vi.fn();
    query().watch!("q", listener);
    expect(listener).not.toHaveBeenCalled();
  });

  test("unsubscribe detaches and is idempotent", () => {
    const box = query();
    const listener = vi.fn();
    const unwatch = box.watch!("q", listener);
    unwatch();
    expect(() => unwatch()).not.toThrow();
    window.history.replaceState(null, "", "/?q=x");
    pop();
    expect(listener).not.toHaveBeenCalled();
  });

  test("multiple watch registrations are independent", () => {
    const box = query();
    const a = vi.fn();
    const b = vi.fn();
    box.watch!("q", a);
    const unB = box.watch!("q", b);
    unB();
    window.history.replaceState(null, "", "/?q=x");
    pop();
    expect(a).toHaveBeenCalledWith("x");
    expect(b).not.toHaveBeenCalled();
  });
});

describe("query — SSR fallback sub-branches", () => {
  test("falls back to memory when window.history is missing", () => {
    const desc = Object.getOwnPropertyDescriptor(window, "history");
    Object.defineProperty(window, "history", { value: undefined, configurable: true });
    try {
      const box = query();
      const value = { a: 1 };
      box.set("k", value);
      expect(box.get("k")).toBe(value); // memory reference semantics
    } finally {
      if (desc) Object.defineProperty(window, "history", desc);
      else delete (window as { history?: unknown }).history;
    }
  });
});

describe("query — custom serializer failure is contained", () => {
  const throwing: Serializer = {
    write: (v) => String(v),
    read: () => {
      throw new Error("bad");
    },
  };

  test("get returns undefined when the serializer throws on read", () => {
    window.history.replaceState(null, "", "/?k=x");
    expect(query({ serializer: throwing }).get("k")).toBeUndefined();
  });

  test("watch swallows a throwing serializer read", () => {
    const box = query({ serializer: throwing });
    const listener = vi.fn();
    box.watch!("k", listener);
    window.history.replaceState(null, "", "/?k=x");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(listener).not.toHaveBeenCalled();
  });
});
