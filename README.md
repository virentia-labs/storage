# Virentia Storage

**Inspired by effector-storage**

Persist state into pluggable storage backends — `localStorage`, `sessionStorage`, the URL query string, memory, or your own — with two-way sync.

## Links

- Documentation: [movpushmov.dev/virentia](https://movpushmov.dev/virentia)

## Packages

- [`@virentia/storage-core`](packages/core/README.md) — the storage boxes (`local`, `session`, `query`, `memory`, `custom`) and `persist` for Virentia stores.

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## Release

```sh
pnpm changeset          # describe a package change
pnpm prepare-release    # version, install, typecheck, test, build
```

Commit the generated release changes, push `main`, then run the **Release** workflow. See [.changeset/README.md](.changeset/README.md).

## License

MIT © 2026 movpushmov
