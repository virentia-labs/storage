import type { CustomStorage } from "../../lib";

/**
 * An in-memory {@link CustomStorage} backend that records every call in order,
 * so a test can assert exactly what `custom` delegated and in what sequence.
 */
export function mapBackend(): CustomStorage & { calls: string[] } {
  const store = new Map<string, unknown>();
  const calls: string[] = [];
  return {
    calls,
    get(key) {
      calls.push(`get:${key}`);
      return store.get(key);
    },
    set(key, value) {
      calls.push(`set:${key}`);
      store.set(key, value);
    },
    remove(key) {
      calls.push(`remove:${key}`);
      store.delete(key);
    },
  };
}
