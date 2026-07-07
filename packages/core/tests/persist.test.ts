import { owner, scope, scoped, store } from "@virentia/core";
import { describe, expect, test } from "vitest";

import { memory, persist } from "../lib";

const read = <T>(s: ReturnType<typeof scope>, unit: { value: T }) =>
  scoped(s, () => unit.value);

describe("persist", () => {
  test("hydrates the store from an existing stored value", () => {
    const box = memory([["count", 7]]);
    const count = store(0);
    const app = scope();

    persist({ source: count, key: "count", storage: box, scope: app });

    expect(read(app, count)).toBe(7);
  });

  test("seeds the box from the store when the key is absent", () => {
    const box = memory();
    const count = store(5);
    const app = scope();

    persist({ source: count, key: "count", storage: box, scope: app });

    expect(box.get("count")).toBe(5);
  });

  test("writes committed store changes to the box", () => {
    const box = memory();
    const count = store(0);
    const app = scope();

    persist({ source: count, key: "count", storage: box, scope: app });
    scoped(app, () => {
      count.value = 42;
    });

    expect(box.get("count")).toBe(42);
  });

  test("pulls external box changes back into the store", () => {
    const box = memory();
    const count = store(0);
    const app = scope();

    persist({ source: count, key: "count", storage: box, scope: app });
    box.set("count", 99); // external write → watch → store

    expect(read(app, count)).toBe(99);
  });

  test("uses the active scope when none is passed", () => {
    const box = memory([["count", 3]]);
    const count = store(0);
    const app = scope();

    scoped(app, () => {
      persist({ source: count, key: "count", storage: box });
    });

    expect(read(app, count)).toBe(3);
  });

  test("throws when there is no scope", () => {
    const box = memory();
    const count = store(0);

    expect(() => persist({ source: count, key: "count", storage: box })).toThrow(/no active scope/);
  });

  test("is isolated per scope", () => {
    const box = memory();
    const count = store(0);
    const bound = scope();
    const other = scope();

    persist({ source: count, key: "count", storage: box, scope: bound });

    scoped(other, () => {
      count.value = 123; // a different scope's value must not be persisted
    });

    expect(box.get("count")).toBe(0);
  });

  test("applies serialize/deserialize", () => {
    const box = memory();
    const when = store(new Date("2020-01-01T00:00:00.000Z"));
    const app = scope();

    persist({
      source: when,
      key: "when",
      storage: box,
      scope: app,
      serialize: (d) => d.toISOString(),
      deserialize: (raw) => new Date(raw as string),
    });

    scoped(app, () => {
      when.value = new Date("2021-06-01T00:00:00.000Z");
    });

    expect(box.get("when")).toBe("2021-06-01T00:00:00.000Z");
  });

  test("stop() detaches both directions", () => {
    const box = memory();
    const count = store(0);
    const app = scope();

    const stop = persist({ source: count, key: "count", storage: box, scope: app });
    stop();

    scoped(app, () => {
      count.value = 1;
    });
    expect(box.get("count")).toBe(0); // store → box detached

    box.set("count", 2);
    expect(read(app, count)).toBe(1); // box → store detached: store keeps its own value
  });

  test("owner dispose tears the binding down", () => {
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
});
