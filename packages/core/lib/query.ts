import type { Serializer, StorageBox } from "./box";
import { memory } from "./memory";

/**
 * Default query serializer, tuned for readable URLs: strings pass through
 * verbatim (no `%22` quoting), everything else is JSON. On read it tries JSON
 * first and falls back to the raw string, so `?q=docs` reads back as `"docs"`
 * and `?page=2` as `2`. Pass your own {@link Serializer} when you need strict
 * string round-tripping.
 */
export const querySerializer: Serializer = {
  write: (value) => (typeof value === "string" ? value : JSON.stringify(value)),
  read: (raw) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  },
};

export interface QueryBoxOptions {
  /** How param values are encoded. Defaults to {@link querySerializer}. */
  serializer?: Serializer;
  /**
   * Whether a write adds a new history entry (`"push"`) or rewrites the current
   * one (`"replace"`). Defaults to `"replace"` — persisting UI state should not
   * spam the back button.
   */
  history?: "push" | "replace";
}

/**
 * URL query-string box: each key is a `?key=value` search param. Reads and
 * writes go through `history.replaceState` (or `pushState`), which do **not**
 * fire `popstate`, so our own writes never echo. `watch` observes `popstate`,
 * i.e. back/forward navigation. Falls back to {@link memory} outside the
 * browser (SSR).
 */
export function query(options: QueryBoxOptions = {}): StorageBox {
  if (typeof window === "undefined" || !window.history || !window.location) {
    return memory();
  }

  const serializer = options.serializer ?? querySerializer;
  const mode = options.history ?? "replace";

  const params = () => new URLSearchParams(window.location.search);

  const commit = (next: URLSearchParams) => {
    const search = next.toString();
    const url = window.location.pathname + (search ? `?${search}` : "") + window.location.hash;

    if (mode === "push") {
      window.history.pushState(window.history.state, "", url);
    } else {
      window.history.replaceState(window.history.state, "", url);
    }
  };

  return {
    get(key) {
      const raw = params().get(key);
      if (raw === null) return undefined;

      try {
        return serializer.read(raw);
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      const next = params();
      const encoded = serializer.write(value);
      // Non-string encodings (e.g. `JSON.stringify(undefined)`) mean the value
      // is unrepresentable — drop the param rather than write the literal
      // `?key=undefined`, keeping `get(key) === undefined` equivalent to absent.
      if (typeof encoded !== "string") {
        next.delete(key);
      } else {
        next.set(key, encoded);
      }
      commit(next);
    },
    remove(key) {
      const next = params();
      next.delete(key);
      commit(next);
    },
    watch(key, listener) {
      const handler = () => {
        const raw = params().get(key);
        if (raw === null) {
          listener(undefined);
          return;
        }

        try {
          listener(serializer.read(raw));
        } catch {
          /* ignore malformed param */
        }
      };

      window.addEventListener("popstate", handler);
      return () => window.removeEventListener("popstate", handler);
    },
  };
}
