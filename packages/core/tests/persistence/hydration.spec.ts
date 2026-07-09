import { scope, store } from "@virentia/core";
import { describe, expect, it } from "vitest";

import { memory, persist } from "../../lib";
import { countingBox } from "../support/counting-box";
import { readIn } from "../support/scope";

describe("persist hydration", () => {
  describe("when the box already holds the key", () => {
    it("seeds the store from the stored value", () => {
      const box = memory([["count", 7]]);
      const count = store(0);
      const app = scope();
      persist({ source: count, key: "count", storage: box, scope: app });
      expect(readIn(app, count)).toBe(7);
    });

    it("applies deserialize to the stored value", () => {
      const iso = "2020-01-01T00:00:00.000Z";
      const box = memory([["when", iso]]);
      const when = store(new Date(0));
      const app = scope();
      persist({
        source: when,
        key: "when",
        storage: box,
        scope: app,
        deserialize: (r) => new Date(r as string),
      });
      expect((readIn(app, when) as Date).toISOString()).toBe(iso);
    });

    it("does not re-notify when the stored value equals the store's value", () => {
      const box = memory([["k", 0]]);
      const count = store(0);
      const app = scope();
      const seen: unknown[] = [];
      count.subscribe((v, s) => {
        if (s === app) seen.push(v);
      });
      persist({ source: count, key: "k", storage: box, scope: app });
      expect(seen).toEqual([]);
      expect(readIn(app, count)).toBe(0);
    });

    it("does not write back to the box", () => {
      const box = countingBox();
      box.set("k", 7); // 1 external set
      const count = store(0);
      const app = scope();
      persist({ source: count, key: "k", storage: box, scope: app }); // pull path, no push
      expect(box.sets).toBe(1);
      expect(readIn(app, count)).toBe(7);
    });

    it("propagates a deserialize error, fail-fast", () => {
      const box = memory([["k", "raw"]]);
      const count = store(0);
      const app = scope();
      expect(() =>
        persist({
          source: count,
          key: "k",
          storage: box,
          scope: app,
          deserialize: () => {
            throw new Error("bad-deserialize");
          },
        }),
      ).toThrow("bad-deserialize");
    });
  });

  describe("when the key is absent", () => {
    it("seeds the box from the store's current value", () => {
      const box = memory();
      const count = store(5);
      const app = scope();
      persist({ source: count, key: "count", storage: box, scope: app });
      expect(box.get("count")).toBe(5);
    });

    it("applies serialize to the store's value", () => {
      const box = memory();
      const when = store(new Date("2021-06-01T00:00:00.000Z"));
      const app = scope();
      persist({
        source: when,
        key: "when",
        storage: box,
        scope: app,
        serialize: (d) => d.toISOString(),
      });
      expect(box.get("when")).toBe("2021-06-01T00:00:00.000Z");
    });

    it("propagates a serialize error, fail-fast", () => {
      const box = memory();
      const count = store(0);
      const app = scope();
      expect(() =>
        persist({
          source: count,
          key: "k",
          storage: box,
          scope: app,
          serialize: () => {
            throw new Error("bad-serialize");
          },
        }),
      ).toThrow("bad-serialize");
    });
  });
});
