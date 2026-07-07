// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { query, querySerializer } from "../lib";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("querySerializer", () => {
  test("keeps strings verbatim and JSON-encodes the rest", () => {
    expect(querySerializer.write("docs")).toBe("docs");
    expect(querySerializer.write(2)).toBe("2");
    expect(querySerializer.write({ a: 1 })).toBe('{"a":1}');
  });

  test("reads JSON when possible, else the raw string", () => {
    expect(querySerializer.read("docs")).toBe("docs");
    expect(querySerializer.read("2")).toBe(2);
    expect(querySerializer.read('{"a":1}')).toEqual({ a: 1 });
  });
});

describe("query", () => {
  test("writes and reads a search param", () => {
    const box = query();

    box.set("q", "docs");

    expect(window.location.search).toBe("?q=docs");
    expect(box.get("q")).toBe("docs");
  });

  test("removes a param without dropping the others", () => {
    const box = query();
    box.set("q", "docs");
    box.set("page", 2);

    box.remove("q");

    expect(box.get("q")).toBeUndefined();
    expect(box.get("page")).toBe(2);
  });

  test("replaces history by default (no new entry)", () => {
    const spy = vi.spyOn(window.history, "pushState");
    const box = query();

    box.set("q", "docs");

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test("pushes a new entry when configured", () => {
    const spy = vi.spyOn(window.history, "pushState");
    const box = query({ history: "push" });

    box.set("q", "docs");

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test("watch reacts to popstate navigation", () => {
    const box = query();
    const listener = vi.fn();
    box.watch!("q", listener);

    window.history.replaceState(null, "", "/?q=next");
    window.dispatchEvent(new PopStateEvent("popstate"));

    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener.mock.calls).toEqual([["next"], [undefined]]);
  });
});
