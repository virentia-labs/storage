import { describe, expect, it, vi } from "vitest";

import { memory } from "../../lib";

describe("memory watch", () => {
  it("does not fire on registration", () => {
    const box = memory();
    box.set("k", 1);
    const listener = vi.fn();
    box.watch!("k", listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("passes the new value as the sole argument", () => {
    const box = memory();
    const seen: unknown[][] = [];
    box.watch!("k", (...args) => seen.push(args));
    box.set("k", 9);
    expect(seen).toEqual([[9]]);
  });

  it("notifies again when the same value is re-set", () => {
    const box = memory();
    const listener = vi.fn();
    box.set("k", 1);
    box.watch!("k", listener);
    box.set("k", 1); // no de-duplication of equal values
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("records [value] on a write then [undefined] on a removal, ignoring other keys", () => {
    const box = memory();
    const listener = vi.fn();
    box.watch!("k", listener);
    box.set("k", 1);
    box.set("other", 2);
    box.remove("k");
    expect(listener.mock.calls).toEqual([[1], [undefined]]);
  });

  it("does not fire for a write to a different key", () => {
    const box = memory();
    const listener = vi.fn();
    box.watch!("a", listener);
    box.set("b", 1);
    box.remove("b");
    expect(listener).not.toHaveBeenCalled();
  });

  describe("on a removal", () => {
    it("notifies once with undefined when a present key is cleared by set(key, undefined)", () => {
      const box = memory();
      const listener = vi.fn();
      box.set("k", 1);
      box.watch!("k", listener);
      box.set("k", undefined);
      expect(listener.mock.calls).toEqual([[undefined]]);
      expect(box.get("k")).toBeUndefined();
    });

    it("does not notify when the key was never set", () => {
      const box = memory();
      const listener = vi.fn();
      box.watch!("k", listener);
      box.remove("k"); // never present
      expect(listener).not.toHaveBeenCalled();
      expect(() => box.remove("k")).not.toThrow();
    });

    it("does not notify when the key was only seeded as undefined", () => {
      // `get` cannot tell present-undefined from absent, so the invariant that a
      // seeded-undefined key is truly absent is observed through `remove`.
      const box = memory([["a", undefined]]);
      const listener = vi.fn();
      box.watch!("a", listener);
      box.remove("a");
      expect(listener).not.toHaveBeenCalled();
    });

    it("does not notify when set(key, undefined) targets an absent key", () => {
      const box = memory();
      const listener = vi.fn();
      box.watch!("k", listener);
      box.set("k", undefined);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("several listeners on one key", () => {
    it("notifies all of them in registration order", () => {
      const box = memory();
      const order: string[] = [];
      box.watch!("k", () => order.push("a"));
      box.watch!("k", () => order.push("b"));
      box.set("k", 1);
      expect(order).toEqual(["a", "b"]);
    });

    it("registers a repeated function only once", () => {
      const box = memory();
      const listener = vi.fn();
      box.watch!("k", listener);
      box.watch!("k", listener); // Set de-duplicates by identity
      box.set("k", 1);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("unsubscribe", () => {
    it("stops delivering to the listener", () => {
      const box = memory();
      const listener = vi.fn();
      const unwatch = box.watch!("k", listener);
      unwatch();
      box.set("k", 1);
      expect(listener).not.toHaveBeenCalled();
    });

    it("is idempotent", () => {
      const box = memory();
      const listener = vi.fn();
      const unwatch = box.watch!("k", listener);
      unwatch();
      expect(() => unwatch()).not.toThrow();
      box.set("k", 1);
      expect(listener).not.toHaveBeenCalled();
    });

    it("never evicts a sibling subscription on the same key", () => {
      // A stale unsubscribe from an emptied-then-recreated key must not drop a
      // newer subscription — the motivation for the set-identity guard.
      const box = memory();
      const a = vi.fn();
      const b = vi.fn();

      const unA = box.watch!("k", a); // Set1 = {a}
      unA(); // Set1 empties -> listeners['k'] deleted
      box.watch!("k", b); // recreate listeners['k'] = Set2 = {b}
      unA(); // stale: must NOT delete Set2

      box.set("k", 1);
      expect(b).toHaveBeenCalledWith(1);
    });
  });

  describe("when a listener throws", () => {
    it("still notifies the siblings", () => {
      const box = memory();
      const after = vi.fn();
      box.watch!("k", () => {
        throw new Error("boom");
      });
      box.watch!("k", after);
      box.set("k", 1);
      expect(after).toHaveBeenCalledWith(1);
    });

    it("does not unwind into the writer", () => {
      const box = memory();
      box.watch!("k", () => {
        throw new Error("boom");
      });
      box.watch!("k", vi.fn());
      expect(() => box.set("k", 1)).not.toThrow();
    });
  });

  describe("during a notification", () => {
    it("stops a sibling that a running listener unsubscribes before it is reached", () => {
      const box = memory();
      const order: string[] = [];
      let unB: () => void = () => {};
      box.watch!("k", () => {
        order.push("a");
        unB(); // detach the not-yet-notified sibling mid-emit
      });
      unB = box.watch!("k", () => order.push("b"));
      box.set("k", 1);
      expect(order).toEqual(["a"]); // b was detached before the emit reached it
    });

    it("lets a listener unsubscribe itself without throwing or skipping siblings", () => {
      const box = memory();
      const after = vi.fn();
      let unSelf: () => void = () => {};
      unSelf = box.watch!("k", () => unSelf());
      box.watch!("k", after);
      expect(() => box.set("k", 1)).not.toThrow();
      expect(after).toHaveBeenCalledWith(1);
    });
  });
});
