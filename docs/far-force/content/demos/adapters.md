# Adapter Demo (IndexedDB vs Memory)

## Why Adapters?
- **IndexedDB**: persistent, async storage available in browsers.
- **Memory**: deterministic, process-local storage for SSR/tests/Node scripts.

## Switching Adapters
```ts
// Browser usage (default):
const client = await connect(todoSchema); // adapter defaults to 'auto'

// Force IndexedDB:
const client = await connect(todoSchema, { adapter: 'auto', dbName: 'my-db' });

// Force memory (e.g., in tests or SSR):
const client = await connect(todoSchema, { adapter: 'memory' });
```

## Demo Locations
- `zapping-zero/src/lib/db/demoQueries.ts` — uses `{ adapter: 'memory' }` so every render starts with a clean slate.
- `zapping-zero/src/lib/db/schema.ts` — uses default adapter; when executed in the browser, it opens IndexedDB and persists data between reloads.

## How to Verify
1. In the Astro app, inspect DevTools > Application > IndexedDB to see stores created when components call the default `getClient()`.
2. Swap adapters in `demoQueries.ts` or `ProductPager` to compare persisted vs ephemeral behavior.
3. In tests (e.g., Vitest), always prefer the memory adapter to avoid unavailable IndexedDB APIs.
