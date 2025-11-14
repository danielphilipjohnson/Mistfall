# API Reference

## Builders
- `t.int(opts?)`, `t.bigint`, `t.float`, `t.decimal({ precision, scale, mode })`, `t.varchar({ length, enum? })`, `t.text`, `t.boolean`, `t.timestamp({ mode, fsp })`, `t.json<T>()`, `t.enum(values)`.
- Modifiers (`ColumnBuilder` chainable):
  - `.primaryKey()` (also makes column not null).
  - `.identity()` / `.generatedAlwaysAsIdentity()` sets up auto-increment.
  - `.notNull()`, `.unique()`.
  - `.default(value)` (literal), `.$defaultFn(fn)` (computed on insert), `.$onUpdate(fn)`.
  - `.references(() => otherTable.column, { onDelete?: 'restrict' | 'cascade' })`.
- Index helpers: `index('name').on(table.column)`, `uniqueIndex('name').on(table.column)`, `.onComputed(row => row.foo, 'fieldName')`.
- `table('name', columns, (cols) => [index(...)])` returns a typed table with `table.columns` and `table.columnName` shortcuts.
- `schema({ name, version, namespace? }, { tableA, tableB })` wires up the schema metadata and resolves foreign keys.

## Runtime
```ts
const client = await connect(schema, { adapter?: 'auto' | 'memory', dbName?: string });
```
- `insert(table, values | values[])` ➜ typed rows with defaults applied.
- `select(table, { where?, orderBy?, order?, limit?, offset? })` where predicate uses `pred.*` helpers.
- `update(table, whereFn, patch)` merges patch into rows; `whereFn` is sync predicate.
- `delete(table, whereFn)` removes rows respecting FK restrict rules.
- `transaction([tables...], async (trx) => { await trx.insert(...); })` scopes multiple operations into one IDB transaction.
- `close()` closes the underlying IDB database (no-op for memory adapter).

## QueryOptions
- `where`: `(row) => boolean` (compose via `pred.eq`, `pred.gt`, `pred.lt`, `pred.and`, `pred.or`).
- `orderBy`: column key or function `(row) => key`.
- `order`: `'asc' | 'desc'`.
- `limit`, `offset`: pagination controls.

## Predicates (`src/predicates.ts`)
- `pred.eq(selector, value)`.
- `pred.neq`.
- `pred.gt`, `pred.lt` (numbers/strings/bigints).
- `pred.and(...predicates)`, `pred.or(...predicates)`.

## Adapters
- `'auto'` (default): uses IndexedDB when available, otherwise memory.
- `'memory'`: purely in-memory structure, useful for SSR/tests.
