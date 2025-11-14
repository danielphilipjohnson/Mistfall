# Todo Demo

## Files
- `src/examples/todo.ts` — source package example (schema + seeding + transaction helper).
- `zapping-zero/src/lib/db/todo.ts` — Astro copy of the same schema (importing from package source during development).
- `zapping-zero/src/lib/db/demoQueries.ts` — memory-adapter walkthrough with seed, filters, update/delete, and `reassignTodos` transaction.
- `zapping-zero/src/components/TodoDashboard.tsx` — basic CRUD UI (client island) using `getClient()`.
- `zapping-zero/src/components/QueryShowcase.tsx` — renders JSON snapshots for the query demo & transaction output.

## Schema Highlights
```ts
export const todos = table('todos', {
  id: t.int().primaryKey().identity(),
  title: t.varchar({ length: 256 }).notNull(),
  status: t.enum(['pending','in-progress','done']).default('pending'),
  ownerId: t.int().references(() => users.id).notNull(),
  updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
}, (tbl) => [index('todos_owner_idx').on(tbl.ownerId)]);
```

- Uses `.identity()` for PK, `.references()` to link to `users`, `$defaultFn` + `$onUpdate` to auto-stamp timestamps.

## Transaction Demo (`reassignTodos`)
- Wraps `client.transaction([users, todos], async (trx) => { ... })`.
- Validates target user exists, ensures every todo belongs to the source user, and updates them atomically.
- Returns the updated todos so UI can reflect the change.

## Astro Integration
- `src/lib/db/schema.ts` exports `getClient()` that calls `connect(todoSchema)` and `seedTodoData` once.
- Client-side React components call `getClient()` inside `useEffect`, use `client.select`/`client.insert`/`client.update` as needed.
- Query showcase uses the memory adapter for deterministic, per-run data; dashboard uses default adapter (IndexedDB in browser).

## Suggested Reads
- `zapping-zero/src/lib/db/demoQueries.ts` for predicate usage (`pred.eq`, `pred.gt`, `pred.and`) + pagination (limit/offset).
- `src/runtime.ts` transaction implementation if you want to extend error handling or custom rollbacks.
