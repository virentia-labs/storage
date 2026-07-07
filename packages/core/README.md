# @virentia/storage-core

Persist [Virentia](https://movpushmov.dev/virentia) stores into pluggable storage backends — `localStorage`, `sessionStorage`, the URL query string, memory, or your own — with two-way sync.

## Install

```sh
pnpm add @virentia/storage-core @virentia/core
```

`@virentia/core` is a peer dependency.

## Storage boxes

A **box** is a small backend the library reads from and writes to. Five are built in:

| Box | Backing store | Survives | Cross-context sync |
|-----|---------------|----------|--------------------|
| `local()` | `localStorage` | reloads, restarts | other tabs (`storage` event) |
| `session()` | `sessionStorage` | reloads (per tab) | — |
| `query()` | URL `?key=value` | in the URL / history | back / forward (`popstate`) |
| `memory()` | in-process `Map` | the session | same process |
| `custom(impl)` | anything you supply | up to you | up to you |

The DOM-backed boxes fall back to `memory()` when their environment is missing (SSR, workers) or blocked (private mode), so the same model code runs on the server unchanged.

## `persist`

`persist` keeps one writable store and one box in sync, both ways, for one scope:

```ts
import { scope, scoped, store } from "@virentia/core";
import { local, persist } from "@virentia/storage-core";

const theme = store<"light" | "dark">("light");
const app = scope();

scoped(app, () => {
  persist({ source: theme, key: "theme", storage: local() });
});
```

- **hydrate** — if the box already holds `key`, the store is seeded from it; otherwise the box is seeded from the store.
- **store → box** — every committed change in the bound scope is written out.
- **box → store** — external changes (another tab, back/forward) are pulled back in, when the box supports `watch`.

`persist` returns a `stop()` disposer and, inside an `owner`, tears itself down on dispose. Pass `{ scope }` explicitly instead of relying on the ambient scope when you need to.

### Options

```ts
persist({
  source,        // StoreWritable<T> — the store to persist
  key,           // string — the box key
  storage,       // StorageBox — local() | session() | query() | memory() | custom()
  scope,         // Scope — defaults to the current active scope
  serialize,     // (value: T) => unknown — value → stored form
  deserialize,   // (raw: unknown) => T — stored form → value
});
```

`serialize`/`deserialize` cover values a box can't round-trip on its own (e.g. a `Date`):

```ts
persist({
  source: lastSeen,
  key: "lastSeen",
  storage: local(),
  serialize: (d) => d.toISOString(),
  deserialize: (raw) => new Date(raw as string),
});
```

## Custom boxes

```ts
import { custom } from "@virentia/storage-core";

const cookies = custom({
  get: (key) => readCookie(key),
  set: (key, value) => writeCookie(key, value),
  remove: (key) => deleteCookie(key),
  // optional: watch(key, listener) => () => void
});
```

## Serialization

The string-backed boxes (`local`, `session`, `query`) take a `serializer` option (default `jsonSerializer`). `query` defaults to `querySerializer`, which keeps strings verbatim for readable URLs and JSON-encodes everything else.

## License

MIT © 2026 movpushmov
