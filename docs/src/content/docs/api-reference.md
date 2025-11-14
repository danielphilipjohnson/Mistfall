---
title: API Reference
description: Exhaustive list of schema builders, runtime helpers, predicates, and adapter options exposed by the Mistfall DSL.
---

This reference covers every exported primitive in Mistfall: schema builders, column modifiers, index helpers, runtime utilities, predicates, and adapter options. Combine it with the demos for end-to-end context.

## Imports

```ts
import {
  table,
  schema,
  t,
  index,
  uniqueIndex,
} from 'mistfall/builders';
import { connect, type DatabaseClient } from 'mistfall/runtime';
import * as pred from 'mistfall/predicates';
```

## Column Builders (`t.*`)

All columns start with a builder from `t`. Each builder returns a chainable `ColumnBuilder` whose type is inferred from the options you pass. See [Data Types](#data-types) for a deep dive into every builder’s options and best practices.

```ts
const todos = table('todos', {
  id: t.int().primaryKey().identity(),
  title: t.varchar({ length: 256 }).notNull(),
  status: t.enum(['pending', 'done']).default('pending'),
  metadata: t.json<Record<string, unknown>>()
});
```

Once a builder is declared you can chain modifiers such as `.notNull()` or `.references(...)` as documented below.

## Data Types

### Numeric

| Builder | Options | Use cases & notes |
| --- | --- | --- |
| `t.int()` | `{ unsigned?: boolean }` | 32-bit integers; use for identities, counters, FK columns. Combine with `.identity()` for auto-increment behaviour. |
| `t.bigint()` | `{ mode?: 'bigint' \| 'number'; unsigned?: boolean }` | 64-bit integers; default TypeScript output is `bigint`. Switch to `mode: 'number'` if your app can’t work with native `bigint`. |
| `t.float()` | _none_ | IEEE floating point. Good for telemetry-style values but avoid for money. |
| `t.decimal()` | `{ precision: number; scale: number; mode?: 'string' \| 'number' \| 'bigint' }` | Fixed precision decimals. Store currency as `mode: 'string'` to avoid rounding issues. |

### Strings & enums

| Builder | Options | Use cases & notes |
| --- | --- | --- |
| `t.varchar()` | `{ length: number; enum?: readonly string[] }` | Length-constrained string. Provide `enum` to narrow the TypeScript type without storing enum metadata in IndexedDB. |
| `t.text()` | `{ enum?: readonly string[] }` | Unbounded string. Optional `enum` works the same as `t.varchar`. |
| `t.enum(values)` | `values: readonly string[]` | Convenience wrapper that emits a literal-union column without configuring length. Backed by the same storage as `t.text`. |

### Temporal

| Builder | Options | Use cases & notes |
| --- | --- | --- |
| `t.timestamp()` | `{ mode?: 'number' \| 'date'; fsp?: number }` | Store timestamps as epoch numbers (`mode: 'number'`) or `Date` objects. `fsp` (fractional seconds precision) mirrors SQL semantics for consistent comparisons. |

### Booleans & JSON

| Builder | Options | Use cases & notes |
| --- | --- | --- |
| `t.boolean()` | _none_ | Standard boolean flag. Serialized as `0/1` under the hood for IndexedDB indexes. |
| `t.json<T>()` | `<T = unknown>` generic | Persist structured objects/arrays. Provide a generic to retain inference: `t.json<{ filter: string[] }>()`. |

> Need something more custom? Compose derived indexes with `.onComputed(...)` to project values (e.g., lowercase strings) without duplicating data. If IndexedDB introduces new key paths we can extend this list over time.

## Column Modifiers

Chain these on any builder to describe constraints and runtime behaviour:

| Modifier | Description |
| --- | --- |
| `.primaryKey()` | Marks column as PK (implies `.notNull()`). |
| `.identity()` | Auto-increment integer (alias: `.generatedAlwaysAsIdentity()`). |
| `.notNull()` | Disallow `null` at runtime and in types. |
| `.unique()` | Create unique constraint. |
| `.default(value)` | Literal default applied during inserts. |
| `.$defaultFn(fn)` | Function run per insert; use for timestamps/uuids. |
| `.$onUpdate(fn)` | Function run whenever row updates. |
| `.references(() => otherTable.column, { onDelete?: 'restrict' \| 'cascade' })` | Foreign key reference with delete rule. |

## Index Helpers

```ts
index('todos_owner_idx').on(todos.ownerId);
uniqueIndex('users_email_idx')
  .on(users.email)
  .onComputed((row) => row.email.toLowerCase(), 'email_lower');
```

- `index(name)` and `uniqueIndex(name)` create builders.
- `.on(column)` registers a single-column index.
- `.onColumns((cols) => [cols.userId, cols.status])` for composite indexes.
- `.onComputed(selector, key)` indexes values derived from the row.

## Tables & Schema

```ts
export const todos = table('todos', {
  id: t.int().primaryKey().identity(),
  title: t.varchar({ length: 256 }).notNull(),
  status: t.enum(['pending', 'in-progress', 'done']).default('pending'),
}, (tbl) => [index('todos_owner_idx').on(tbl.status)]);

export const todoSchema = schema({ name: 'mistfall-demo', version: 1 }, { todos });
```

- `table(name, columns, indexes?)` returns a typed object with `columns` map and column shortcuts.
- `schema({ name, version, namespace? }, tables)` wires foreign keys, version metadata, and IDB store definitions.
- Bump `version` to trigger IndexedDB migrations.

## Runtime Client

```ts
const client = await connect(todoSchema, {
  adapter: 'auto',
  dbName: 'mistfall-demo',
});
```

### `connect(schema, options?)`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `adapter` | `'auto' \| 'memory'` | `'auto'` | Auto uses IndexedDB in browsers, memory elsewhere. |
| `dbName` | `string` | `schema.name` | Override IndexedDB database name. |
| `onUpgrade` | `(event) => void` | `undefined` | Hook into IDB `onupgradeneeded` events. |

Returns a `DatabaseClient<Schema>` with typed helpers below.

### CRUD Helpers

```ts
await client.insert(todos, { title: 'Write docs' });
await client.select(todos, { where: pred.eq((row) => row.status, 'pending') });
await client.update(todos, (row) => row.id === id, { status: 'done' });
await client.delete(todos, (row) => row.status === 'done');
```

| Method | Signature | Notes |
| --- | --- | --- |
| `insert(table, value | value[])` | Returns inserted row(s) with defaults applied. |
| `select(table, options?)` | Resolves to array of rows. Supports `where`, `orderBy`, `order`, `limit`, `offset`. |
| `update(table, whereFn, patch)` | Applies partial patch to rows matching predicate. Returns affected rows. |
| `delete(table, whereFn)` | Removes rows; enforces FK `restrict`. Returns count. |
| `close()` | Closes IndexedDB connection (no-op in memory mode). |

### `QueryOptions`

```ts
interface QueryOptions<TRow> {
  where?: (row: TRow) => boolean;
  orderBy?: keyof TRow | ((row: TRow) => IDBValidKey);
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

Combine with predicate helpers for composable filtering.

### Transactions

```ts
await client.transaction([users, todos], async (trx) => {
  const reassigned = await trx.update(todos, (row) => row.ownerId === fromId, {
    ownerId: toId,
  });
  return reassigned;
});
```

- `transaction(tables, handler)` opens a single IndexedDB transaction across the provided stores.
- The `trx` object exposes the same CRUD API as `client`, scoped to the transaction.
- Supports nesting via `trx.transaction(...)` for composability.

## Predicate Helpers

All predicates live in `mistfall/predicates`. They return functions consumed by `where`.

| Helper | Signature | Use |
| --- | --- | --- |
| `pred.eq` | `pred.eq(selector, value)` | Equality check. |
| `pred.neq` | `pred.neq(selector, value)` | Inequality. |
| `pred.gt` / `pred.gte` | `(selector, value)` | Greater-than (numbers / strings / bigints). |
| `pred.lt` / `pred.lte` | `(selector, value)` | Less-than variants. |
| `pred.startsWith` | `(selector, prefix)` | String prefix match. |
| `pred.contains` | `(selector, value)` | Array/string contains. |
| `pred.and` | `pred.and(...predicates)` | Logical AND composition. |
| `pred.or` | `pred.or(...predicates)` | Logical OR composition. |
| `pred.not` | `pred.not(predicate)` | Negation helper. |

> Tip: You can mix predicate helpers with inline predicates. Anything that returns `(row) => boolean` is valid.

## Adapter Behaviour

| Adapter | When to use | Characteristics |
| --- | --- | --- |
| `auto` (default) | Browser apps, most demos | Uses IndexedDB when available, falls back to memory during SSR/tests. Handles migrations based on `schema.version`. |
| `memory` | Unit tests, Node scripts, SSR-only flows | Stores data in JS Maps. Enforces the same constraints as IndexedDB but is process-local and ephemeral. |

Switch adapters per call: `connect(schema, { adapter: 'memory' })`.

## Error Handling

- Schema validation errors throw during `connect` if a table lacks a primary key or references a missing column.
- Runtime operations throw when FK/unique constraints fail.
- Wrap CRUD calls in `try/catch` to surface useful UI errors.

## TypeScript Tips

- `DatabaseClient<typeof schema>` infers tables, columns, and return types for you.
- Use `typeof todos.$inferInsert` / `$inferSelect` to type UI components.
- When working in memory mode during tests, keep types identical to production by sharing the exported schema.

Need a specific example? Check the [Runtime CRUD demo](/demos/runtime-crud/) and [Transactions demo](/demos/transactions/) for real-world snippets using everything described here.
