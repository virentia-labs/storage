import { owner, scope, scoped, store } from "@virentia/core";
import { describe, expect, it } from "vitest";

import { memory, persist } from "../../lib";
import { readIn } from "../support/scope";

describe("persist lifecycle", () => {
  describe("scope resolution", () => {
    it("uses the active scope when none is passed", () => {
      const box = memory([["count", 3]]);
      const count = store(0);
      const app = scope();
      scoped(app, () => {
        persist({ source: count, key: "count", storage: box });
      });
      expect(readIn(app, count)).toBe(3);
    });

    it("throws when no scope is active and none is passed", () => {
      const box = memory();
      const count = store(0);
      expect(() => persist({ source: count, key: "count", storage: box })).toThrow(
        /no active scope/,
      );
    });
  });

  describe("teardown", () => {
    it("detaches both directions on stop", () => {
      const box = memory();
      const count = store(0);
      const app = scope();
      const stop = persist({ source: count, key: "count", storage: box, scope: app });
      stop();

      scoped(app, () => {
        count.value = 1;
      });
      expect(box.get("count")).toBe(0); // store -> box detached

      box.set("count", 2);
      expect(readIn(app, count)).toBe(1); // box -> store detached; store keeps its own value
    });

    it("is idempotent on stop", () => {
      const box = memory();
      const count = store(0);
      const app = scope();
      const stop = persist({ source: count, key: "count", storage: box, scope: app });
      stop();
      expect(() => stop()).not.toThrow();
      scoped(app, () => {
        count.value = 9;
      });
      expect(box.get("count")).toBe(0);
    });

    it("stays live when created without an active owner", () => {
      // onCleanup(stop) is a no-op with no owner; the binding must stay live.
      const box = memory();
      const count = store(0);
      const app = scope();
      persist({ source: count, key: "count", storage: box, scope: app });
      scoped(app, () => {
        count.value = 3;
      });
      expect(box.get("count")).toBe(3);
    });

    it("tears down on owner dispose", () => {
      const box = memory();
      const count = store(0);
      const app = scope();
      const model = owner(() => {
        persist({ source: count, key: "count", storage: box, scope: app });
        return {};
      });
      model.dispose();
      scoped(app, () => {
        count.value = 5;
      });
      expect(box.get("count")).toBe(0);
    });

    it("does not evict a sibling binding on a manual stop then an owner dispose", () => {
      // Regression for the memory-unsubscribe set-identity fix: P1's teardown must
      // not knock out P2's box->store watch.
      const box = memory();
      const p1Store = store(0);
      const p2Store = store(0);
      const s1 = scope();
      const s2 = scope();

      let stopP1: () => void = () => {};
      const model = owner(() => {
        stopP1 = persist({ source: p1Store, key: "k", storage: box, scope: s1 });
        return {};
      });

      stopP1(); // manual stop removes P1's watch, emptying + dropping listeners['k']
      persist({ source: p2Store, key: "k", storage: box, scope: s2 }); // recreates listeners['k']
      model.dispose(); // fires onCleanup(stopP1) again — must NOT evict P2

      box.set("k", 77); // external write must still reach P2
      expect(readIn(s2, p2Store)).toBe(77);
    });
  });
});
