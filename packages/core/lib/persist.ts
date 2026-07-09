import { getCurrentScope, onCleanup, scoped } from "@virentia/core";
import type { Scope, StoreWritable } from "@virentia/core";

import type { StorageBox } from "./box";

export interface PersistOptions<T> {
  /** The writable store whose value is mirrored into the box. */
  source: StoreWritable<T>;
  /** The box key to store under. */
  key: string;
  /** Where to persist — `local()`, `session()`, `query()`, `memory()`, `custom()`. */
  storage: StorageBox;
  /**
   * The scope whose value is persisted. Defaults to the current active scope
   * (call `persist` inside `scoped(scope, …)`). Persistence is inherently
   * per-scope: one browser has one `localStorage`, so a binding pairs exactly
   * one scope with the box.
   */
  scope?: Scope;
  /** Transform the store value before it is written. Defaults to identity. */
  serialize?: (value: T) => unknown;
  /** Transform a stored value before it is written back into the store. Defaults to identity. */
  deserialize?: (raw: unknown) => T;
}

/**
 * Keep a Virentia store and a storage box in sync, both ways:
 *
 * 1. **hydrate** — if the box already holds `key`, seed the store from it;
 *    otherwise seed the box from the store's current value.
 * 2. **store → box** — write on every committed change in the bound scope.
 * 3. **box → store** — when the box supports `watch`, pull external changes
 *    (other tabs, back/forward) back into the store.
 *
 * A re-entrancy guard breaks the write↔watch feedback loop. If called inside an
 * `owner`, the binding is torn down on dispose; the returned `stop()` detaches
 * it manually.
 */
export function persist<T>(options: PersistOptions<T>): () => void {
  const { source, key, storage } = options;
  const scope = options.scope ?? getCurrentScope();

  if (!scope) {
    throw new Error(
      `persist("${key}"): no active scope. Call it inside scoped(scope, () => …) or pass { scope }.`,
    );
  }

  const serialize = options.serialize ?? ((value: T) => value as unknown);
  const deserialize = options.deserialize ?? ((raw: unknown) => raw as T);

  // Guards the write↔watch loop: set while we drive one side, so the change it
  // provokes on the other side is recognized as our own echo and ignored. Both
  // boxes and stores notify synchronously, so a single flag suffices.
  let busy = false;

  const pull = (raw: unknown) => {
    busy = true;
    try {
      scoped(scope, () => {
        source.value = deserialize(raw);
      });
    } finally {
      busy = false;
    }
  };

  const push = (value: T) => {
    busy = true;
    try {
      storage.set(key, serialize(value));
    } finally {
      busy = false;
    }
  };

  // 1. hydrate
  const stored = storage.get(key);
  if (stored !== undefined) {
    pull(stored);
  } else {
    push(scoped(scope, () => source.value));
  }

  // 2. store → box (only for this scope, only for changes we didn't cause).
  // The store's notify loop does NOT isolate subscribers, so a persistence
  // failure here (e.g. a value the serializer can't encode) must not escape:
  // it would starve sibling subscribers and throw into the code that committed
  // the change. Isolate it — the value simply isn't persisted. (Hydrate above
  // is deliberately *not* isolated: a setup-time error is fail-fast.)
  const unsubscribe = source.subscribe((value, changedScope) => {
    if (busy || changedScope !== scope) return;
    try {
      push(value);
    } catch {
      /* this value could not be persisted; the reactive graph stays intact */
    }
  });

  // 3. box → store
  const unwatch = storage.watch?.(key, (raw) => {
    if (busy) return;
    // Key removed externally: keep the current in-memory value rather than
    // clobbering it with `undefined`.
    if (raw === undefined) return;
    try {
      pull(raw);
    } catch {
      /* a malformed external value can't be applied; keep the current one */
    }
  });

  const stop = () => {
    unsubscribe();
    unwatch?.();
  };

  // No-ops when there is no active owner.
  onCleanup(stop);

  return stop;
}
