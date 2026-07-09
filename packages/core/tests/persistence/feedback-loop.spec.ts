import { scope, scoped, store } from "@virentia/core";
import { describe, expect, it, vi } from "vitest";

import { memory, persist } from "../../lib";
import { countingBox } from "../support/counting-box";
import { readIn } from "../support/scope";

describe("persist feedback-loop guard", () => {
  it("notifies exactly once on a store change, suppressing the synchronous echo", () => {
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

  it("does not re-write the box in response to its own store-to-box write", () => {
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

  it("updates the store on an external write without a re-push", () => {
    const box = countingBox();
    const count = store(0);
    const app = scope();
    persist({ source: count, key: "count", storage: box, scope: app }); // seed: 1 set
    box.set("count", 42); // external: 1 set; the pull must not push back
    expect(box.sets).toBe(2);
    expect(readIn(app, count)).toBe(42);
  });

  it("never deserializes its own store-to-box write", () => {
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

  it("survives a non-inverse serialize/deserialize without looping or diverging", () => {
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

    expect(readIn(app, count)).toBe(5); // store keeps the user's value; no runaway
    expect(box.get("count")).toBe(1005);
  });
});
