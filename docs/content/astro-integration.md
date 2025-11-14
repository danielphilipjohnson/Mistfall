# Astro Integration Guide

## Linking the Package
1. `npm install ../specs` (or the published package) inside your Astro project.
2. If consuming local source during development, import via relative paths (`../../src/index`) so hot reload sees changes. For production/published builds, use the package entry (`mistfall`).

## Client vs SSR
- Schema DSL + runtime are SSR-safe: you can import them from page/server files without crashing.
- IndexedDB is browser-only, so any call to `connect(schema)` must happen in client-side code (React/Vue/Svelte components with `client:load`/`client:visible`).
- For SSR/tests, pass `{ adapter: 'memory' }` to `connect` to avoid touching IndexedDB.

## Typical Setup
1. **Shared helper** (`src/lib/db/schema.ts`):
   ```ts
   import { connect } from 'mistfall';
   import { todoSchema, seedTodoData, todos, users } from 'mistfall/examples/todo';

   export async function getClient() {
     const client = await connect(todoSchema);
     await seedTodoData(client);
     return client;
   }
   export const tables = { todos, users };
   ```
2. **Client component** (`TodoDashboard.tsx`): call `getClient()` in `useEffect`, perform CRUD, store results in state.
3. **Islands**: render components with `client:load` so `getClient()` runs in the browser.

## Testing
- Use the memory adapter (`connect(schema, { adapter: 'memory' })`) in Vitest/Playwright to run CRUD + transaction tests without needing IndexedDB mocks.
- You can seed data in `beforeEach` and tear it down by discarding the client.

## Working with Transactions
- For complex flows (checkout, multi-table updates), wrap the logic in exported helpers (`checkoutCart`, `reassignTodos`) inside your package and call them from the UI. Transactions automatically enforce allowed tables and roll back on failure.

## Vite/Astro Notes
- When importing local `.ts` files (during dev), include the extension (`import ... from './todo.ts'`) so Vite resolves correctly.
- Remove generated `.js/.d.ts` stubs from `src/lib/db` to avoid module name collisions.
- Restart `npm run dev` after editing the DSL package to ensure Astro picks up the rebuilt code.
