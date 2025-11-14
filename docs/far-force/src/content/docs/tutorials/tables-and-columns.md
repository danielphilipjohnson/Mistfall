---
description: "This tutorial dives into every field/modifier available when declaring tables and columns with the DSL. Use it as a reference when designing schemas beyond the Todo/Ecommerce examples."
title: "In-Depth Guide: Building Tables & Columns"
---

# In-Depth Guide: Building Tables & Columns

This tutorial dives into every field/modifier available when declaring tables and columns with the DSL. Use it as a reference when designing schemas beyond the Todo/Ecommerce examples.

## Column Builders
`import { t } from 'indexedb-drizzle';`

| Builder | Description |
| --- | --- |
| `t.int({ unsigned? })` | 32-bit integer stored as number. |
| `t.bigint({ mode?: 'bigint' | 'number'; unsigned? })` | 64-bit integer; choose JS `bigint` or `number`. |
| `t.float()` | Floating point number. |
| `t.decimal({ precision, scale, mode?: 'string' | 'number' | 'bigint' })` | Fixed-point stored as string. |
| `t.varchar({ length, enum? })` | Fixed-length string. Optional `enum` narrows the TypeScript type. |
| `t.text({ enum? })` | Long-form string. |
| `t.boolean()` | Boolean. |
| `t.timestamp({ mode?: 'number' | 'date' | 'string'; fsp?: 0-6 })` | Stored as epoch ms by default. |
| `t.json<T>()` | Any JSON-serializable value (`structuredClone`). |
| `t.enum(values)` | Convenience for string unions.

## Modifiers (ColumnBuilder Chain)
```ts
t.int().primaryKey().identity().notNull().unique().default(0);
```

| Modifier | Effect |
| --- | --- |
| `.primaryKey()` | Marks column as primary key (single-column). Also sets `notNull`. |
| `.identity()` / `.generatedAlwaysAsIdentity()` | Auto-increment via sequence store. |
| `.notNull()` | Disallow `null`/`undefined`. |
| `.unique()` | Adds a unique constraint (native index). |
| `.default(value)` | Literal default applied during insert. |
| `.$defaultFn(() => value)` | Function runs on insert to compute default. |
| `.$onUpdate(prev => next)` | Function runs on update when column omitted from patch. |
| `.references(() => otherTable.column, { onDelete })` | Sets FK metadata. `onDelete` defaults to `'restrict'`. |

## Attaching Columns to Tables
```ts
const chores = table('chores', {
  id: t.int().primaryKey().identity(),
  description: t.text().notNull(),
  status: t.enum(['new','active','done'] as const).default('new'),
  assigneeId: t.int().references(() => users.id).notNull(),
  metadata: t.json<{ tags: string[] }>().default({ tags: [] }),
});
```
- Tables expose `chores.columns` plus ergonomic accessors `chores.description`, etc.
- The builder enforces at least one primary key; it throws at runtime if you forget.

## Indexes
```ts
const tasks = table('tasks', {...}, (cols) => [
  index('tasks_owner_idx').on(cols.ownerId),
  uniqueIndex('tasks_external_id_idx').on(cols.externalId),
]);
```
- Use `index` for non-unique, `uniqueIndex` for unique constraints.
- For composite/computed keys: `index('idx').onComputed((row) => `${row.a}-${row.b}`, '__idx_a_b')` and ensure you set the computed field when writing rows.

## Schema Definition
```ts
export const appSchema = schema({ name: 'my-app', version: 1 }, { users, chores, tasks });
```
- `name` becomes the IndexedDB database name.
- `version` increments trigger `onupgradeneeded` (additive migrations supported). |
- `namespace` optional; defaults to `name` and prefixes store names (`namespace__table`).

## Type Inference
- `InferSelect<typeof chores>` → read shape (all columns required).
- `InferInsert<typeof chores>` → insert shape (optional columns when defaults/nullable).
- `InferUpdate<typeof chores>` → partial of select shape.

## Field-Level Defaults Example
```ts
const posts = table('posts', {
  id: t.int().primaryKey().identity(),
  slug: t.varchar({ length: 120 }).unique().notNull(),
  body: t.text().notNull(),
  views: t.int().default(0),
  publishedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()),
  updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
});
```
- `.default(0)` ensures `views` is always a number even if omitted.
- `$defaultFn` timestamps every insert; `$onUpdate` stamps updates.

## Foreign Keys & On Delete
```ts
const comments = table('comments', {
  id: t.int().primaryKey().identity(),
  postId: t.int().references(() => posts.id, { onDelete: 'restrict' }).notNull(),
  authorId: t.int().references(() => users.id).notNull(),
});
```
- `onDelete: 'restrict'` (default) prevents deleting parent rows referenced by children.
- Future extensions can support `'cascade'` (spec already allows passing it).

## Putting It Together
1. Declare tables with the DSL.
2. Register them in a schema.
3. Build (`npm run build`) to emit types.
4. Import tables into runtime code, call `connect(schema)`, and enjoy type-safe CRUD + transactions.

For end-to-end usage (CRUD, predicates, transactions, pagination, adapters), see `docs/tutorials/full-guide.md` and the demos inside `docs/demos/`.
