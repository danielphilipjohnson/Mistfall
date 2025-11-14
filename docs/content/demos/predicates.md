# Predicates & Filtering Demo

Showcases the helper functions from `src/predicates.ts` applied to Todo queries.

## Helpers
- `pred.eq(selector, value)`
- `pred.gt(selector, value)` / `pred.lt`
- `pred.and(...predicates)` / `pred.or(...predicates)`

## Example Usage (`zapping-zero/src/lib/db/demoQueries.ts`)
```ts
const pending = await client.select(todos, {
  where: pred.eq((row) => row.status, 'pending'),
  orderBy: (row) => row.title,
});

const dueSoon = await client.select(todos, {
  where: pred.gt((row) => row.dueAt ?? 0, Date.now()),
  order: 'asc',
  orderBy: (row) => row.dueAt ?? 0,
  limit: 5,
});

await client.update(
  todos,
  pred.and(
    (row) => row.status === 'pending',
    pred.eq((row) => row.ownerId, 1)
  ),
  { status: 'in-progress' }
);
```

## Steps
1. Edit the predicates in `demoQueries.ts` to explore different operators (e.g., `pred.lt`, `pred.or`).
2. Reload the Astro page; `QueryShowcase` prints each query result so you can verify the filters.
3. Combine `pred.and`/`pred.or` for compound logic.

Tip: Predicates are just functions; you can author inline `(row) => row.ownerId === bobId` or re-use `pred.*` helpers for clarity.
