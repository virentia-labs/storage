import type { StorageBox } from "./box";

/**
 * In-memory box backed by a `Map`. Holds references (no serialization), never
 * touches the DOM, and is the safe fallback the DOM-backed boxes degrade to
 * when their environment is missing (SSR, workers, tests).
 *
 * `watch` fires **synchronously** for same-process writes, so several `persist`
 * bindings sharing one memory box stay in sync (and `persist`'s echo guard,
 * which is synchronous, holds).
 */
export function memory(initial?: Iterable<readonly [string, unknown]>): StorageBox {
  const values = new Map<string, unknown>();
  // `undefined` is the absence sentinel — never keep a key whose value is
  // `undefined`, so `get(key) === undefined` always means "absent".
  if (initial) {
    for (const [key, value] of initial) {
      if (value !== undefined) values.set(key, value);
    }
  }

  const listeners = new Map<string, Set<(value: unknown) => void>>();

  function emit(key: string, value: unknown): void {
    const set = listeners.get(key);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(value);
      } catch {
        // Isolate listeners: one throwing watcher must not break siblings on
        // the same key, nor unwind into the code that performed the write.
      }
    }
  }

  function drop(key: string): void {
    if (values.delete(key)) emit(key, undefined);
  }

  return {
    get: (key) => values.get(key),
    set(key, value) {
      if (value === undefined) {
        drop(key); // setting `undefined` is a removal (absence sentinel)
        return;
      }
      values.set(key, value);
      emit(key, value);
    },
    remove: (key) => drop(key),
    watch(key, listener) {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(listener);

      return () => {
        // Set-identity aware: a stale second call is a safe no-op, and it must
        // never evict a newer subscription that reused this key after our set
        // was emptied and dropped from the map — hence the `=== set` check.
        set.delete(listener);
        if (set.size === 0 && listeners.get(key) === set) {
          listeners.delete(key);
        }
      };
    },
  };
}
