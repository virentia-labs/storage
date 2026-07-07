import { jsonSerializer, type StorageBox, type StringBoxOptions } from "./box";
import { memory } from "./memory";

/**
 * Probe a Web Storage area for real usability. Merely *reading* `localStorage`
 * can throw (sandboxed iframes, disabled cookies), and Safari private mode
 * throws on `setItem`, so we round-trip a probe key and fall back to memory on
 * any failure.
 */
function probe(read: () => Storage | undefined | null): Storage | null {
  try {
    const store = read();
    if (!store) return null;

    const probeKey = "__virentia_storage_probe__";
    store.setItem(probeKey, probeKey);
    store.removeItem(probeKey);

    return store;
  } catch {
    return null;
  }
}

function createWebStorageBox(
  read: () => Storage | undefined | null,
  options: StringBoxOptions,
): StorageBox {
  const store = probe(read);

  // SSR / unavailable / blocked → behave, but keep values in memory instead of
  // crashing so the same model code runs unchanged on the server.
  if (!store) {
    return memory();
  }

  const serializer = options.serializer ?? jsonSerializer;
  const canWatch = typeof window !== "undefined" && typeof window.addEventListener === "function";

  return {
    get(key) {
      const raw = store.getItem(key);
      if (raw === null) return undefined;

      try {
        return serializer.read(raw);
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      store.setItem(key, serializer.write(value));
    },
    remove(key) {
      store.removeItem(key);
    },
    watch: canWatch
      ? (key, listener) => {
          const handler = (event: StorageEvent) => {
            // A `storage` event fires only in *other* documents sharing the
            // area, so this never echoes our own writes. `event.key === null`
            // means `clear()` — treat as removal.
            if (event.storageArea !== store) return;
            if (event.key !== null && event.key !== key) return;

            if (event.newValue === null) {
              listener(undefined);
              return;
            }

            try {
              listener(serializer.read(event.newValue));
            } catch {
              /* ignore malformed external value */
            }
          };

          window.addEventListener("storage", handler);
          return () => window.removeEventListener("storage", handler);
        }
      : undefined,
  };
}

/**
 * `localStorage`-backed box: persistent across reloads, shared across tabs of
 * the same origin. Cross-tab writes surface through `watch`. Falls back to
 * {@link memory} when Web Storage is unavailable or blocked.
 */
export function local(options: StringBoxOptions = {}): StorageBox {
  return createWebStorageBox(() => globalThis.localStorage, options);
}

/**
 * `sessionStorage`-backed box: scoped to one tab and cleared when it closes.
 * Falls back to {@link memory} when Web Storage is unavailable or blocked.
 */
export function session(options: StringBoxOptions = {}): StorageBox {
  return createWebStorageBox(() => globalThis.sessionStorage, options);
}
