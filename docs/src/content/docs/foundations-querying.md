---
title: Querying Data
description: Learn how to filter, sort, paginate, and project data with Mistfall’s runtime and predicate helpers.
---

Mistfall’s runtime ships with a typed `select` API and composable predicates. This guide covers everything from simple filters to cursor-style pagination so you can read data efficiently in Astro islands or tests.

## Reading rows

```ts
const todos = await client.select(tables.todos);
```

- Returns an array of typed rows (`typeof todos.$inferSelect`).
- Without options, records come back in insertion order.

## Filtering with `where`

### Inline predicates

```ts
await client.select(todos, {
  where: (row) => row.status === 'pending' && row.ownerId === userId,
});
```

- Any synchronous `(row) => boolean` function works.
- Refer to captured variables for dynamic filters (e.g., `userId`).

### Predicate helpers

Import from `mistfall/predicates` to keep filters declarative and reusable.

```ts
const pending = await client.select(todos, {
  where: pred.eq((row) => row.status, 'pending'),
});

const dueSoon = await client.select(todos, {
  where: pred.and(
    pred.eq((row) => row.ownerId, userId),
    pred.lt((row) => row.dueAt ?? Infinity, Date.now() + 7 * 864e5),
  ),
});
```

Common helpers:

| Helper | Description |
| --- | --- |
| `pred.eq` / `pred.neq` | Equality / inequality checks. |
| `pred.gt` / `pred.gte` | Greater-than comparisons (numbers, strings, bigint). |
| `pred.lt` / `pred.lte` | Less-than comparisons. |
| `pred.contains` | Array/string contains. |
| `pred.startsWith` | Prefix match for strings. |
| `pred.and` / `pred.or` / `pred.not` | Boolean composition helpers. |

> Tip: export predicate factories from your data layer so UI code can reuse the same filters without duplicating logic.

## Ordering results

```ts
await client.select(products, {
  orderBy: (row) => row.name.toLowerCase(),
  order: 'asc',
});
```

- `orderBy` accepts a key (`'name'`) or selector function.
- `order` defaults to `'asc'`; set `'desc'` for reverse order.
- Combine with `pred.startsWith` to create alphabetical pickers.

## Pagination

Mistfall uses `limit` + `offset` for numeric pagination.

```ts
const PAGE_SIZE = 20;

const page = await client.select(products, {
  where: pred.gt((row) => row.inventory ?? 0, 0),
  orderBy: (row) => row.name,
  offset,
  limit: PAGE_SIZE,
});

const hasNext = page.length === PAGE_SIZE;
```

- Track `offset` in state (`offset + PAGE_SIZE` for next page).
- Index the sorted column to keep pagination snappy.
- For cursor-style pagination, store the `IDBValidKey` returned by `orderBy` and filter on `pred.gt`/`pred.lt` instead of using `offset`.

## Projecting data

Need a subset of fields? Use array methods:

```ts
const titles = (await client.select(todos)).map((todo) => todo.title);
```

For heavier projections, write helper functions or derive indexes with `.onComputed` to avoid expensive transforms at runtime.

## Counting rows

Mistfall doesn’t have a dedicated count API, but you can emulate it:

```ts
const totalPending = (await client.select(todos, {
  where: pred.eq((row) => row.status, 'pending'),
})).length;
```

For large datasets, consider a dedicated counter table updated via triggers/transactions.

## Updating with predicates

Reuse the same predicate helpers when mutating data:

```ts
await client.update(todos, pred.eq((row) => row.id, todoId), {
  status: 'done',
});
```

- Keeps filtering logic centralized.
- Works inside `transaction` blocks with the same semantics as `client.select`.

## Debugging queries

- In devtools, inspect the IndexedDB object store to verify indexes and key paths.
- Log predicate functions (or names) when composing filters to ensure the proper conditions apply.
- When using the memory adapter, queries run synchronously—wrap them in `queueMicrotask` if you need async boundaries.

Pair these patterns with the [Predicates demo](/demos/predicates/) and [Pagination demo](/demos/pagination/) to see them in action.
