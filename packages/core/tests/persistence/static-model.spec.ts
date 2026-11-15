import { scope, scoped, store } from "@virentia/core";
import { children, f, refs, staticModel, trait } from "@virentia/core/models";
import { expect, it } from "vitest";
import { memory, persist, type StorageBox } from "../../lib";

function bindingModel() {
  return staticModel({
    setup() {
      const count = store(0);
      return {
        count,
        connect(storage: StorageBox) {
          // The bound method enters the instance scope and lifetime.
          return persist({ source: count, key: "count", storage });
        },
      };
    },
  });
}

it("disposes only one staticModel binding and supports a fresh instance with the same id", async () => {
  const Binding = bindingModel();
  const app = scope(), other = scope();
  const a = scoped(app, () => Binding.create({ id: "same" }));
  const b = scoped(app, () => Binding.create({ id: "sibling" }));
  const c = scoped(other, () => Binding.create({ id: "same" }));
  const boxes = [memory(), memory(), memory()];
  try {
    [a, b, c].forEach((model, index) => model.connect(boxes[index]));
    expect(a.count.node).toBe(b.count.node);
    expect(b.count.node).toBe(c.count.node);
    a.count.value = 1;
    b.count.value = 2;
    c.count.value = 3;
    expect(boxes.map(box => box.get("count"))).toEqual([1, 2, 3]);

    await a.dispose();
    boxes[0].set("count", 10);
    boxes[1].set("count", 20);
    boxes[2].set("count", 30);
    expect([b.count.value, c.count.value]).toEqual([20, 30]);

    const reused = scoped(app, () => Binding.create({ id: "same" }));
    try {
      expect(reused.count.value).toBe(0);
      const freshBox = memory();
      reused.connect(freshBox);
      boxes[0].set("count", 100);
      expect(reused.count.value).toBe(0);
      reused.count.value = 4;
      expect(freshBox.get("count")).toBe(4);
      expect(boxes[0].get("count")).toBe(100);
      expect([b.count.value, c.count.value]).toEqual([20, 30]);
    } finally {
      await reused.dispose();
    }
  } finally {
    await a.dispose(); await b.dispose(); await c.dispose();
  }
});

it("persists an owned child's store from its parent's bound method", async () => {
  const CounterState = trait({ data: { count: f.number(0) } });
  const Counter = staticModel({ with: [CounterState] });
  const Parent = staticModel({
    data: { counter: children.one(Counter) },
    setup(self) { return { connect(storage: StorageBox) {
      return persist({ source: self.counter.value!.count, key: "count", storage });
    } }; },
    onCreate(self) { self.counter.create({}); },
  });
  const [a, b] = scoped(scope(), () => Parent.create([{}, {}]));
  const boxes = [memory(), memory()];
  try {
    a.connect(boxes[0]); b.connect(boxes[1]);
    a.counter.value!.count.value = 7;
    expect(boxes.map(box => box.get("count"))).toEqual([7, 0]);
    boxes[1].set("count", 9);
    expect([a.counter.value!.count.value, b.counter.value!.count.value]).toEqual([7, 9]);
    await a.dispose();
    boxes[1].set("count", 11);
    expect(b.counter.value!.count.value).toBe(11);
  } finally { await a.dispose(); await b.dispose(); }
});

it("shares a referenced child's persistence without transferring its ownership", async () => {
  const Counter = staticModel({ data: { count: f.number(0) } });
  const Draft = staticModel({ data: { counter: children.one(Counter) }, onCreate(self) { self.counter.create({}); } });
  const Editor = staticModel({
    data: { counter: refs.one(Counter).policy("nullify") },
    setup(self) { return { connect(storage: StorageBox) {
      return persist({ source: self.counter.value!.count, key: "count", storage });
    } }; },
  });
  const app = scope(), draft = scoped(app, () => Draft.create({}));
  const [a, b] = scoped(app, () => Editor.create([{ counter: draft.counter.value!.id }, { counter: draft.counter.value!.id }]));
  const first = memory(), second = memory();
  try {
    a.connect(first); b.connect(second);
    draft.counter.value!.count.value = 3;
    expect([first.get("count"), second.get("count")]).toEqual([3, 3]);
    await a.dispose();
    expect(draft.counter.value!.alive).toBe(true);
    first.set("count", 100);
    expect(draft.counter.value!.count.value).toBe(3);
    second.set("count", 4);
    expect(draft.counter.value!.count.value).toBe(4);
  } finally { await a.dispose(); await b.dispose(); await draft.dispose(); }
});

it("keeps a sibling watch after manual stop followed by staticModel disposal", async () => {
  const Binding = bindingModel(), app = scope();
  const [a, b] = scoped(app, () => Binding.create([{ id: "a" }, { id: "b" }]));
  const box = memory();
  try {
    const stop = a.connect(box);
    stop();
    b.connect(box);
    await a.dispose();
    box.set("count", 77);
    expect(b.count.value).toBe(77);
    b.count.value = 78;
    expect(box.get("count")).toBe(78);
  } finally {
    await a.dispose(); await b.dispose();
  }
});
