// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { query } from "../../lib";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("query history", () => {
  it("replaces the current entry by default, adding none", () => {
    const push = vi.spyOn(window.history, "pushState");
    query().set("q", "docs");
    expect(push).not.toHaveBeenCalled();
  });

  it("adds a new entry when history is 'push'", () => {
    const push = vi.spyOn(window.history, "pushState");
    query({ history: "push" }).set("q", "docs");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("passes the exact URL string to replaceState", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    query().set("q", "docs");
    expect(replace).toHaveBeenCalledWith(null, "", "/?q=docs");
  });

  it("preserves the pathname, hash, and history state on a replace", () => {
    window.history.replaceState({ id: 1 }, "", "/page?x=1#sec");
    query().set("q", "docs");
    expect(window.location.pathname).toBe("/page");
    expect(window.location.hash).toBe("#sec");
    expect(window.location.search).toBe("?x=1&q=docs");
    expect(window.history.state).toEqual({ id: 1 });
  });

  it("preserves the URL, hash, and history state on the new entry in push mode", () => {
    window.history.replaceState({ id: 9 }, "", "/page?x=1#sec");
    const push = vi.spyOn(window.history, "pushState");
    query({ history: "push" }).set("q", "docs");
    expect(push).toHaveBeenCalledWith({ id: 9 }, "", "/page?x=1&q=docs#sec");
    expect(window.location.search).toBe("?x=1&q=docs");
    expect(window.location.hash).toBe("#sec");
    expect(window.history.state).toEqual({ id: 9 });
  });

  it("preserves insertion order, keeping an in-place update in position", () => {
    const box = query();
    box.set("a", 1);
    box.set("b", 2);
    box.set("a", 3); // update in place
    expect(window.location.search).toBe("?a=3&b=2");
  });

  it("commits a no-op when removing an absent key", () => {
    const box = query();
    box.set("a", 1);
    box.remove("missing");
    expect(window.location.search).toBe("?a=1");
  });
});
