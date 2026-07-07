/**
 * A storage backend the library can persist values into and read them back
 * from. Values crossing this interface are already **deserialized** — a box
 * that speaks strings underneath (Web Storage, the URL) owns its own
 * serialization; a box that keeps references (memory) does not serialize at all.
 *
 * `get` returns `undefined` when the key is absent. `watch` is optional: a box
 * implements it only when it can observe **external** changes (another tab, the
 * back/forward button). Boxes that cannot never fire it.
 */
export interface StorageBox {
  /** Read the value stored under `key`, or `undefined` when absent. */
  get(key: string): unknown;
  /** Persist `value` under `key`. */
  set(key: string, value: unknown): void;
  /** Delete `key`. */
  remove(key: string): void;
  /**
   * Observe external changes to `key`. The listener receives the new value, or
   * `undefined` when the key was removed. Returns an unsubscribe function.
   * Absent on boxes that cannot detect outside writes.
   */
  watch?(key: string, listener: (value: unknown) => void): () => void;
}

/** Turns a value into the string a string-backed box stores, and back. */
export interface Serializer {
  read(raw: string): unknown;
  write(value: unknown): string;
}

/** Default serializer: strict JSON in both directions. */
export const jsonSerializer: Serializer = {
  read: (raw) => JSON.parse(raw) as unknown,
  write: (value) => JSON.stringify(value),
};

/** Shared options for the string-backed boxes (`local`, `session`, `query`). */
export interface StringBoxOptions {
  /** How values are encoded to/from strings. Defaults to {@link jsonSerializer}. */
  serializer?: Serializer;
}
