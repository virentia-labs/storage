import type { StorageBox } from "../../lib";
import { memory } from "../../lib";

/**
 * A `memory` box wrapped to count the `set`/`remove` calls it receives. Used by
 * the feedback-loop assertions, where the *number* of writes is the contract.
 */
export function countingBox(): StorageBox & { sets: number; removes: number } {
  const inner = memory();
  const box = {
    sets: 0,
    removes: 0,
    get: (key: string) => inner.get(key),
    set(key: string, value: unknown) {
      box.sets += 1;
      inner.set(key, value);
    },
    remove(key: string) {
      box.removes += 1;
      inner.remove(key);
    },
    watch: inner.watch,
  };
  return box;
}
