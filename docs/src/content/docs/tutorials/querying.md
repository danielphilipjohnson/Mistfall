---
description: "This document enumerates every way to query data with the runtime: `select` options, predicate helpers, ordering, pagination, and mutation predicates for `update`/`delete`."
title: "Querying Guide: Filters, Ordering, Pagination, and Predicates"
---

# Querying Guide: Filters, Ordering, Pagination, and Predicates

This document enumerates every way to query data with the runtime: `select` options, predicate helpers, ordering, pagination, and mutation predicates for `update`/`delete`.

## QueryOptions Overview
When calling `client.select(table, options)`, you can provide:

```ts
interface QueryOptions<TRow> {
  where?: (row: TRow) => boolean;
  orderBy?: keyof TRow | ((row: TRow) => IDBValidKey);
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

All fields are optional. If omitted, the entire store is read in insertion order.

## Filtering (`where`)
- Accepts any synchronous predicate `(row) => boolean`.
- Combine multiple conditions with boolean operators or `pred.*` helpers.

### Predicate Helpers
Defined in `src/predicates.ts`:

| Helper | Description |
| --- | --- |
| `pred.eq(selector, value)` | Strict equality. |
| `pred.neq(selector, value)` | Not equal. |
| `pred.gt(selector, value)` | Greater than (numbers, strings, bigint). |
| `pred.lt(selector, value)` | Less than. |
| `pred.and(...predicates)` | Logical AND across multiple predicates. |
| `pred.or(...predicates)` | Logical OR. |

**Example:**
```ts
const overdue = await client.select(todos, {
  where: pred.and(
    pred.eq((row) => row.status, 'pending'),
    pred.lt((row) => row.dueAt ?? 0, Date.now())
  ),
});
```

You can mix raw inline functions with helpers:
```ts
where: (row) => row.ownerId === aliceId && row.status !== 'done'
```

## Ordering
- `orderBy`: column key (`'updatedAt'`) or function `(row) => row.updatedAt`.
- `order`: `'asc'` (default) or `'desc'`.

```ts
const latest = await client.select(todos, {
  orderBy: 'updatedAt',
  order: 'desc',
});
```

For custom sort keys:
```ts
orderBy: (row) => row.title.toLowerCase()
```

## Pagination
- `limit`: max rows to return.
- `offset`: number of rows to skip before collecting results.

```ts
const page = await client.select(products, {
  where: pred.gt((row) => row.inventory ?? 0, 0),
  orderBy: (row) => row.name.toLowerCase(),
  limit: 10,
  offset: currentCursor,
});
```

Combine with UI state (`cursor`) to build Prev/Next pagination (see `ProductPager.tsx`).

## Mutations with Predicates
`update` and `delete` accept the same predicate style:

```ts
await client.update(
  todos,
  pred.eq((row) => row.ownerId, aliceId),
  { status: 'done' }
);

await client.delete(todos, (row) => row.status === 'archived');
```

Notes:
- Patches in `update` merge onto the existing row after defaults/hook logic.
- Predicates run per row; keep them synchronous and deterministic.

## Transactions + Queries
Inside `client.transaction([...], async (trx) => { ... })`, you get the same API surface. Example from `reassignTodos`:

```ts
await client.transaction([users, todos], async (trx) => {
  const rows = await trx.select(todos, { where: (row) => ids.has(row.id) });
  if (rows.some((todo) => todo.ownerId !== sourceUserId)) throw new Error();
  await trx.update(todos, (row) => ids.has(row.id), { ownerId: targetUserId });
});
```

## IndexedDB vs Memory Behavior
- IndexedDB adapter executes queries within a transaction, then sorts/filters in JS (currently no index-based optimizations).
- Memory adapter iterates over the in-memory Map and applies the same filtering logic.

## Examples in the Repo
- `zapping-zero/src/lib/db/demoQueries.ts` — multiple selects with `pred.eq`, `pred.gt`, ordering, and limit.
- `zapping-zero/src/components/ProductPager.tsx` — pagination via `limit`/`offset`.
- `src/examples/ecommerce.ts` — transaction with `trx.select`, `trx.update`.

This guide ensures you know every option available when querying data through the DSL runtime. Pair it with the DSL + table guide to design schema fields, then apply these querying patterns in your UI.
