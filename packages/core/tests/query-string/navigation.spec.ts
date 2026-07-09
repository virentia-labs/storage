// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Serializer } from "../../lib";
import { query } from "../../lib";
import { popstate, removeWindowListenersAfterEach } from "../support/window";

describe("query watch, on navigation", () => {
  removeWindowListenersAfterEach();
  beforeEach(() => window.history.replaceState(null, "", "/"));
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("notifies with the decoded value after navigation", () => {
    const box = query();
    const listener = vi.fn();
    box.watch!("q", listener);
    window.history.replaceState(null, "", "/?q=next");
    popstate();
    expect(listener).toHaveBeenCalledWith("next");
  });

  it("notifies undefined when the key is gone after navigation", () => {
    const box = query();
    const listener = vi.fn();
    box.watch!("q", listener);
    window.history.replaceState(null, "", "/");
    popstate();
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  it("does not fire on registration", () => {
    const listener = vi.fn();
    query().watch!("q", listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps registrations independent — one unsubscribe leaves the other live", () => {
    const box = query();
    const a = vi.fn();
    const b = vi.fn();
    box.watch!("q", a);
    const unB = box.watch!("q", b);
    unB();
    window.history.replaceState(null, "", "/?q=x");
    popstate();
    expect(a).toHaveBeenCalledWith("x");
    expect(b).not.toHaveBeenCalled();
  });

  it("does not notify when the serializer throws on read", () => {
    const throwing: Serializer = {
      write: (v) => String(v),
      read: () => {
        throw new Error("bad");
      },
    };
    const box = query({ serializer: throwing });
    const listener = vi.fn();
    box.watch!("k", listener);
    window.history.replaceState(null, "", "/?k=x");
    popstate();
    expect(listener).not.toHaveBeenCalled();
  });

  describe("unsubscribe", () => {
    it("stops delivering to the listener", () => {
      const box = query();
      const listener = vi.fn();
      const unwatch = box.watch!("q", listener);
      unwatch();
      window.history.replaceState(null, "", "/?q=x");
      popstate();
      expect(listener).not.toHaveBeenCalled();
    });

    it("is idempotent", () => {
      const unwatch = query().watch!("q", vi.fn());
      unwatch();
      expect(() => unwatch()).not.toThrow();
    });
  });
});
