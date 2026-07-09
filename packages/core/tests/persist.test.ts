import { owner, scope, scoped, store } from "@virentia/core";
import { describe, expect, test, vi } from "vitest";

import { custom, memory, persist, type StorageBox } from "../lib";

const read = <T>(s: ReturnType<typeof scope>, unit: { value: T }) => scoped(s, () => unit.value);

/** A memory box wrapped to count set/remove calls, for feedback-loop assertions. */
function countingBox(): StorageBox & { sets: number; removes: number } {
  const inner = memory();
  const box = {
    sets: 0,
    removes: 0,
    get: (k: string) => inner.get(k),
    set(k: string, v: unknown) {
      box.sets += 1;
      inner.set(k, v);
    },
    remove(k: string) {
      box.removes += 1;
      inner.remove(k);
    },
    watch: inner.watch,
  };
  return box;
}

describe("persist — hydrate", () => {
  test("seeds the store from an existing stored value", () => {
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

  test("applies deserialize when hydrating from the box", () => {
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
    expect((read(app, when) as Date).toISOString()).toBe(iso);
  });

  test("applies serialize when seeding the box", () => {
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

  test("hydrating a value equal to the store's current one causes no redundant notify", () => {
    const box = memory([["k", 0]]);
    const count = store(0);
    const app = scope();
    const seen: unknown[] = [];
    count.subscribe((v, s) => {
      if (s === app) seen.push(v);
    });
    persist({ source: count, key: "k", storage: box, scope: app });
    expect(seen).toEqual([]);
    expect(read(app, count)).toBe(0);
  });

  test("propagates a serialize error thrown while seeding the box", () => {
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

  test("propagates a deserialize error thrown while hydrating", () => {
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

  test("hydrating from a present value does not write back to the box", () => {
    const box = countingBox();
    box.set("k", 7); // 1 external set
    const count = store(0);
    const app = scope();
    persist({ source: count, key: "k", storage: box, scope: app }); // pull path, no push
    expect(box.sets).toBe(1);
    expect(read(app, count)).toBe(7);
  });

  test("a serialize error on a live commit is isolated (graph intact, no throw)", () => {
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
    expect(read(app, value)).toBe(5n); // store committed
    expect(box.get("k")).toBe("0"); // still the seeded serialized value; 5n was skipped, not written
  });

  test("a deserialize error on an external change is isolated (keeps current value)", () => {
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
    expect(read(app, count)).toBe(5); // store keeps its value
  });
});

describe("persist — store → box", () => {
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

  test("applies serialize on write", () => {
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

  test("is isolated per scope — a different scope's change is not persisted", () => {
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

  test("persists to several boxes from one store", () => {
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

  test("persisting an undefined store value removes the key", () => {
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

describe("persist — box → store", () => {
  test("pulls external box changes into the store", () => {
    const box = memory();
    const count = store(0);
    const app = scope();
    persist({ source: count, key: "count", storage: box, scope: app });
    box.set("count", 99);
    expect(read(app, count)).toBe(99);
  });

  test("keeps the current value when the key is removed externally", () => {
    const box = memory();
    const count = store(0);
    const app = scope();
    persist({ source: count, key: "count", storage: box, scope: app });
    scoped(app, () => {
      count.value = 5;
    });
    box.remove("count"); // watch fires undefined -> persist keeps the value
    expect(read(app, count)).toBe(5);
  });

  test("works with a box that has no watch", () => {
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

  test("two bindings sharing one box + key stay in sync", () => {
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
    expect(read(sb, b)).toBe(9);
  });
});

describe("persist — feedback-loop guard (algorithmic)", () => {
  test("a store change notifies exactly once — the synchronous echo is suppressed", () => {
    const box = memory();
    const count = store(0);
    const app = scope();
    persist({ source: count, key: "count", storage: box, scope: app });

    const seen: unknown[] = [];
    count.subscribe((v, s) => {
      if (s === app) seen.push(v);
    });
    scoped(app, () => {
      count.value = 5;
    });

    expect(seen).toEqual([5]); // no echo-induced second notification
    expect(box.get("count")).toBe(5);
  });

  test("persist does not re-write the box in response to its own store→box write", () => {
    const box = countingBox();
    const count = store(0);
    const app = scope();
    persist({ source: count, key: "count", storage: box, scope: app }); // seed: 1 set
    scoped(app, () => {
      count.value = 5;
    });
    expect(box.sets).toBe(2); // seed + the one user write; no echo-driven re-write
    expect(box.get("count")).toBe(5);
  });

  test("an external box write updates the store without a re-push", () => {
    const box = countingBox();
    const count = store(0);
    const app = scope();
    persist({ source: count, key: "count", storage: box, scope: app }); // seed: 1 set
    box.set("count", 42); // external: 1 set; pull must not push back
    expect(box.sets).toBe(2);
    expect(read(app, count)).toBe(42);
  });

  test("persist never deserializes its own store→box write (busy guard on watch)", () => {
    // A synchronous box echo of our own write must be ignored WITHOUT running
    // deserialize — otherwise a non-inverse serialize/deserialize pair would
    // diverge or loop.
    const box = memory();
    const count = store(0);
    const app = scope();
    const deserialize = vi.fn((r: unknown) => r as number);
    persist({ source: count, key: "count", storage: box, scope: app, deserialize });
    deserialize.mockClear();

    scoped(app, () => {
      count.value = 5;
    });

    expect(deserialize).not.toHaveBeenCalled(); // the echo was suppressed, not pulled
    expect(box.get("count")).toBe(5);
  });

  test("survives a non-inverse serialize/deserialize without looping or diverging", () => {
    // serialize/deserialize are NOT inverse; the busy guard must still stop the
    // write→echo→write loop, leaving exactly the value the user set.
    const box = memory();
    const count = store(0);
    const app = scope();
    persist({
      source: count,
      key: "count",
      storage: box,
      scope: app,
      serialize: (v) => v + 1000, // asymmetric on purpose
      deserialize: (r) => r as number,
    });

    scoped(app, () => {
      count.value = 5;
    });

    expect(read(app, count)).toBe(5); // store keeps the user's value; no runaway
    expect(box.get("count")).toBe(1005);
  });
});

describe("persist — scope resolution", () => {
  test("uses the active scope when none is passed", () => {
    const box = memory([["count", 3]]);
    const count = store(0);
    const app = scope();
    scoped(app, () => {
      persist({ source: count, key: "count", storage: box });
    });
    expect(read(app, count)).toBe(3);
  });

  test("throws when there is no active scope and none is passed", () => {
    const box = memory();
    const count = store(0);
    expect(() => persist({ source: count, key: "count", storage: box })).toThrow(/no active scope/);
  });
});

describe("persist — teardown", () => {
  test("stop() detaches both directions", () => {
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
    expect(read(app, count)).toBe(1); // box -> store detached; store keeps its own value
  });

  test("stop() is idempotent", () => {
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

  test("a binding created without an active owner is not auto-torn-down", () => {
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

  test("a manual stop() then an owner dispose does not evict a sibling binding on the same key", () => {
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
    expect(read(s2, p2Store)).toBe(77);
  });
});
