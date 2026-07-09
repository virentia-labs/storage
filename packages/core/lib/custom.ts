import type { StorageBox } from "./box";

/**
 * The shape a caller implements to plug in their own backend — cookies, an
 * `AsyncStorage`-like sync bridge, IndexedDB behind a sync cache, a test
 * double. `get`/`set`/`remove` are required; `watch` is optional and only
 * needed when the backend can report outside changes.
 */
export interface CustomStorage {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  watch?(key: string, listener: (value: unknown) => void): () => void;
}

/**
 * Adapt a user-supplied backend into a {@link StorageBox}. This is the
 * extension point behind the built-in boxes — they are just pre-wired
 * `custom` implementations. Wrapping (instead of passing the object straight
 * through) pins the public surface, so a backend can carry extra methods
 * without leaking them into the box contract.
 */
export function custom(storage: CustomStorage): StorageBox {
  return {
    get: (key) => storage.get(key),
    // Uphold the absence-sentinel contract even for third-party backends:
    // set(key, undefined) is a removal, so the backend never holds `undefined`.
    set: (key, value) => (value === undefined ? storage.remove(key) : storage.set(key, value)),
    remove: (key) => storage.remove(key),
    // Presence is decided by an actual function, not mere truthiness, so a
    // malformed backend can't produce a `watch` that throws when called.
    watch:
      typeof storage.watch === "function"
        ? (key, listener) => storage.watch!(key, listener)
        : undefined,
  };
}
