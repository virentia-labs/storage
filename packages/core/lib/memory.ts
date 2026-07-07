import type { StorageBox } from "./box";

/**
 * In-memory box backed by a `Map`. Holds references (no serialization), never
 * touches the DOM, and is the safe fallback the DOM-backed boxes degrade to
 * when their environment is missing (SSR, workers, tests).
 *
 * `watch` fires for same-process writes, so several `persist` bindings sharing
 * one memory box stay in sync.
 */
export function memory(initial?: Iterable<readonly [string, unknown]>): StorageBox {
  const values = new Map<string, unknown>(
    initial as Iterable<[string, unknown]> | undefined,
  );
  const listeners = new Map<string, Set<(value: unknown) => void>>();

  function emit(key: string, value: unknown): void {
    const set = listeners.get(key);
    if (!set) return;
    for (const listener of set) {
      listener(value);
    }
  }

  return {
    get: (key) => values.get(key),
    set(key, value) {
      values.set(key, value);
      emit(key, value);
    },
    remove(key) {
      values.delete(key);
      emit(key, undefined);
    },
    watch(key, listener) {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(listener);

      return () => {
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(key);
        }
      };
    },
  };
}
