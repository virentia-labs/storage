import { computed } from "@virentia/core";
import { children, f, staticModel, type InstanceOf } from "@virentia/core/models";
import { memory, persist } from "../../lib";

const Counter = staticModel({ data: { count: f.number(0) } });
const Draft = staticModel({ data: { counter: children.one(Counter) } });
declare const draft: InstanceOf<typeof Draft>;
const box = memory();
const stop: () => void = persist({
  source: draft.counter.value!.count, key: "count", storage: box,
  serialize(value) { const number: number = value; return String(number); },
  deserialize(raw) { const unknown: unknown = raw; return Number(unknown); },
});
// @ts-expect-error bound model fields preserve their number value type
persist<number>({ source: draft.counter.value!.count, key: "count", storage: box, deserialize: () => "wrong" });
// @ts-expect-error readonly computed stores cannot become persistence sources
persist({ source: computed(() => draft.counter.value!.count.value), key: "count", storage: box });
void stop;
