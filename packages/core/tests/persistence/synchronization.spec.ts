import { scope, scoped, store } from "@virentia/core";
import { describe, expect, it } from "vitest";

import { custom, memory, persist } from "../../lib";
import { readIn } from "../support/scope";

describe("persist synchronization", () => {
  describe("store to box", () => {
    it("writes each committed change to the box", () => {
      const box = memory();
      const count = store(0);
      const app = scope();
      persist({ source: count, key: "count", storage: box, scope: app });
      scoped(app, () => {
        count.value = 42;
      });
      expect(box.get("count")).toBe(42);
    });

    it("applies serialize on write", () => {
      const box = memory();
      const when = store(new Date("2020-01-01T00:00:00.000Z"));
      const app = scope();
      persist({
        source: when,
        key: "when",
        storage: box,
        scope: app,
        serialize: (d) => d.toISOString(),
        deserialize: (r) => new Date(r as string),
      });
      scoped(app, () => {
        when.value = new Date("2021-06-01T00:00:00.000Z");
      });
      expect(box.get("when")).toBe("2021-06-01T00:00:00.000Z");
    });

    it("ignores a change committed in a different scope", () => {
      const box = memory();
      const count = store(0);
      const bound = scope();
      const other = scope();
      persist({ source: count, key: "count", storage: box, scope: bound });
      scoped(other, () => {
        count.value = 123;
      });
      expect(box.get("count")).toBe(0); // seeded from bound (0); the other scope's 123 is ignored
    });

    it("writes to every box bound to the store", () => {
      const box1 = memory();
      const box2 = memory();
      const count = store(0);
      const app = scope();
      persist({ source: count, key: "a", storage: box1, scope: app });
      persist({ source: count, key: "b", storage: box2, scope: app });
      scoped(app, () => {
        count.value = 7;
      });
      expect(box1.get("a")).toBe(7);
      expect(box2.get("b")).toBe(7);
    });

    it("removes the key when the store value becomes undefined", () => {
      const box = memory();
      const value = store<number | undefined>(5);
      const app = scope();
      persist({ source: value, key: "k", storage: box, scope: app });
      expect(box.get("k")).toBe(5);
      scoped(app, () => {
        value.value = undefined;
      });
      expect(box.get("k")).toBeUndefined();
    });
  });

  describe("box to store", () => {
    it("pulls an external change into the store", () => {
      const box = memory();
      const count = store(0);
      const app = scope();
      persist({ source: count, key: "count", storage: box, scope: app });
      box.set("count", 99);
      expect(readIn(app, count)).toBe(99);
    });

    it("keeps the current value when the key is removed externally", () => {
      const box = memory();
      const count = store(0);
      const app = scope();
      persist({ source: count, key: "count", storage: box, scope: app });
      scoped(app, () => {
        count.value = 5;
      });
      box.remove("count"); // watch fires undefined -> persist keeps the value
      expect(readIn(app, count)).toBe(5);
    });

    it("syncs one-way when the box has no watch", () => {
      const backing = new Map<string, unknown>();
      const box = custom({
        get: (k) => backing.get(k),
        set: (k, v) => void backing.set(k, v),
        remove: (k) => void backing.delete(k),
      });
      const count = store(0);
      const app = scope();
      const stop = persist({ source: count, key: "k", storage: box, scope: app });
      scoped(app, () => {
        count.value = 3;
      });
      expect(box.get("k")).toBe(3);
      expect(() => stop()).not.toThrow();
    });

    it("keeps two bindings on one key in sync", () => {
      const box = memory();
      const a = store(0);
      const b = store(0);
      const sa = scope();
      const sb = scope();
      persist({ source: a, key: "k", storage: box, scope: sa });
      persist({ source: b, key: "k", storage: box, scope: sb });
      scoped(sa, () => {
        a.value = 9;
      });
      expect(readIn(sb, b)).toBe(9);
    });
  });

  describe("when a transform throws on a live change", () => {
    it("contains a serialize error on a store-to-box commit, sparing the graph", () => {
      // Hydrate is fail-fast, but a LIVE commit of an unpersistable value must not
      // escape into the store's non-isolating notify loop: the commit succeeds,
      // sibling subscribers still run, and only the box write is skipped.
      const box = memory();
      const value = store<number | bigint>(0);
      const app = scope();
      persist({
        source: value,
        key: "k",
        storage: box,
        scope: app,
        serialize: (v) => JSON.stringify(v),
      });

      const sibling: unknown[] = [];
      value.subscribe((v, s) => {
        if (s === app) sibling.push(v);
      });

      expect(() =>
        scoped(app, () => {
          value.value = 5n; // JSON.stringify(bigint) throws inside push, but is contained
        }),
      ).not.toThrow();
      expect(sibling).toEqual([5n]); // sibling subscriber was NOT starved
      expect(readIn(app, value)).toBe(5n); // store committed
      expect(box.get("k")).toBe("0"); // still the seeded value; 5n was skipped, not written
    });

    it("contains a deserialize error on a box-to-store change, keeping the value", () => {
      // A box whose watch does NOT isolate listeners, so persist must contain the
      // deserialize throw itself rather than let it escape the external write.
      const inner = new Map<string, unknown>();
      const listeners = new Set<(v: unknown) => void>();
      const box = custom({
        get: (k) => inner.get(k),
        set: (k, v) => {
          inner.set(k, v);
          listeners.forEach((l) => l(v));
        },
        remove: (k) => {
          inner.delete(k);
          listeners.forEach((l) => l(undefined));
        },
        watch: (_k, l) => {
          listeners.add(l);
          return () => void listeners.delete(l);
        },
      });
      const count = store(0);
      const app = scope();
      persist({
        source: count,
        key: "k",
        storage: box,
        scope: app,
        deserialize: (r) => {
          if (r === "bad") throw new Error("boom");
          return r as number;
        },
      });
      scoped(app, () => {
        count.value = 5;
      });
      expect(() => box.set("k", "bad")).not.toThrow(); // persist contains the deserialize throw
      expect(readIn(app, count)).toBe(5); // store keeps its value
    });
  });
});
