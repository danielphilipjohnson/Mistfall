---
title: Working with Schema
description: Practical guide to defining tables, constraints, indexes, and migrations with the Mistfall DSL.
---

Mistfall’s schema layer mirrors Drizzle’s ergonomics while targeting IndexedDB. This guide shows how to plan table structures, add constraints, and choose indexes so your demos scale beyond the basics.

## Schema Fundamentals

### Table Anatomy

Every table call follows the same pattern:

```ts
const users = table('users', {
  id: t.int().primaryKey().identity(),
  email: t.varchar({ length: 256 }).notNull().unique(),
  role: t.enum(['admin', 'member', 'guest']).default('member'),
  createdAt: t.timestamp({ mode: 'number' }).$defaultFn(Date.now).$onUpdate(Date.now),
}, (tbl) => [
  uniqueIndex('users_email_idx').on(tbl.email),
]);
```

1. **Name** – store name inside IndexedDB; keep it stable between versions.
2. **Columns** – built from `t.*` (see [Data Types](/api-reference/#data-types)).
3. **Indexes (optional)** – array returned from the third argument.

> Tip: leverage `$inferInsert`/`$inferSelect` from each table to type UI inputs without duplicating shapes.

### Primary Keys & Identity Columns

- Use `.primaryKey()` on at least one column; Mistfall validates this during `connect`.
- Call `.identity()` (or `.generatedAlwaysAsIdentity()`) on integer PKs to auto-increment.
- Composite PKs can be declared by passing a callback as the third argument:

```ts
const memberships = table('memberships', {
  userId: t.int().references(() => users.id),
  orgId: t.int().references(() => orgs.id),
}, (tbl) => [
  primaryKey('memberships_pk').on(tbl.userId, tbl.orgId),
]);
```

> Mistfall enforces PK uniqueness at runtime for both IndexedDB and memory adapters.

### Unique Constraints

Two options:

1. Chain `.unique()` on a single column (great for emails, handles, slugs).
2. Declare a `uniqueIndex` in the third argument for multi-column guarantees:

```ts
uniqueIndex('sku_store_unique').onColumns((cols) => [cols.storeId, cols.sku]);
```

Violations throw an error during `insert`/`update`, so wrap calls in `try/catch` if you want to display friendly UI feedback.

### Foreign Keys & Cascades

Use `.references(() => otherTable.column, { onDelete })` to link tables:

```ts
const todos = table('todos', {
  ownerId: t.int()
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: t.varchar({ length: 256 }).notNull(),
});
```

Options:
- `onDelete: 'restrict'` (default) blocks deletion when dependents exist.
- `onDelete: 'cascade'` deletes child rows automatically (implemented consistently across adapters).

When referencing columns, always use a callback (`() => users.id`) so Mistfall can resolve circular dependencies.

## Index Strategy

Mistfall persists indexes to IndexedDB and mirrors them in memory mode.

### Choosing an index

| Need | Recommended index |
| --- | --- |
| Filter by FK (`ownerId`, `orgId`) | `index('todos_owner_idx').on(tbl.ownerId)` |
| Sort/paginate with limit/offset | `index('products_name_idx').on(tbl.name)` |
| Case-insensitive search | `uniqueIndex('users_email_idx').onComputed((row) => row.email.toLowerCase(), 'email_lower')` |
| Enforce uniqueness across multiple columns | `uniqueIndex(...).onColumns((cols) => [cols.userId, cols.orgId])` |

### When to skip indexes

- Small tables (<100 rows) can often rely on full scans.
- Highly mutable JSON blobs rarely benefit from indexes—project a derived key instead.

## Default Values & Update Hooks

- `.default(value)` for static defaults.
- `.$defaultFn(() => Date.now())` runs per insert.
- `.$onUpdate(() => Date.now())` runs whenever the row changes (great for `updatedAt`).

Hooks run inside the same transaction as the mutation, so they’re safe for audit fields.

## Schema Versions & Migrations

`schema({ name, version }, tables)` stores the version inside IndexedDB. When you bump `version`:

1. Mistfall runs `onupgradeneeded`, creating new object stores or indexes.
2. Removed tables/columns currently require manual migration—prefer additive changes.
3. Write migration helpers inside your package (e.g., copy data between stores) and call them from `connect` via the `onUpgrade` callback.

```ts
const appSchema = schema({ name: 'mistfall-demo', version: 2 }, { users, todos, orders });
const client = await connect(appSchema, {
  onUpgrade(event) {
    console.info('Upgrading to version', event.newVersion);
  },
});
```

## Checklist Before Shipping

- [ ] Every table declares a primary key.
- [ ] Unique columns use either `.unique()` or a `uniqueIndex`.
- [ ] Foreign keys specify the correct cascade behaviour.
- [ ] Frequently filtered fields have indexes.
- [ ] Schema version bumped after structural changes.

Pair this guide with the [Schema DSL demo](/demos/schema-dsl/) for live examples and the [Migrations guide](/foundations-migrations/) when applying changes to existing data.
