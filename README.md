# Mistfall

> Typed IndexedDB runtime + schema DSL inspired by Drizzle ORM.

Mistfall lets you model relational data with a familiar table/column DSL and run strongly typed queries directly against IndexedDB or an in-memory adapter. The runtime handles schema validation, primary/foreign keys, migrations scaffolding, and convenient predicate helpers so you can keep business logic in TypeScript instead of ad‑hoc IDB requests.

## Features
- Type-safe schema builder with column constraints, computed indexes, and foreign keys
- Unified runtime that auto-selects IndexedDB in browsers or a fast in-memory adapter for SSR/tests
- Simple CRUD API (`insert`, `select`, `update`, `delete`) plus transactional batches
- Predicate helpers (`pred.eq`, `pred.and`, etc.) for reusable filters
- Migration scaffolder that diffs your schema against a live database and emits upgrade scripts
- Ships as an ES module with generated `.d.ts` types for excellent IDE support

## Installation

```bash
npm install mistfall
```

## Define a schema

```ts
// schema.ts
import { schema, table, t, uniqueIndex } from 'mistfall';

export const users = table(
  'users',
  {
    id: t.int().primaryKey().identity(),
    email: t.varchar({ length: 255 }).notNull().unique(),
    displayName: t.text().notNull(),
    role: t.enum(['admin', 'member']).default('member'),
    createdAt: t.timestamp({ mode: 'number' }).default(() => Date.now()),
  },
  (cols) => [uniqueIndex('users_email').on(cols.email)]
);

export const projects = table(
  'projects',
  {
    id: t.int().primaryKey().identity(),
    ownerId: t.int().notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: t.text().notNull(),
    createdAt: t.timestamp().default(() => Date.now()),
  },
  (cols) => [t.index('projects_owner_created').on(cols.ownerId)]
);

const appSchema = schema({ name: 'mistfall_demo', namespace: 'mistfall', version: 1 }, {
  users,
  projects,
});

export default appSchema;
```

- `table()` enforces that at least one column is marked `primaryKey()`.
- Column builders expose familiar constraints (`notNull`, `default`, `identity`, `references`, etc.).
- The third argument configures indexes; you can call `index(name).on(col)` or `index(name).onComputed(row => expression)`.

## Connect & run queries

```ts
import { connect, pred } from 'mistfall';
import appSchema, { users, projects } from './schema';

const db = await connect(appSchema, { dbName: 'mistfall-demo' });

await db.insert(users, {
  email: 'rilla@example.com',
  displayName: 'Rilla',
});

const activeUsers = await db.select(users, {
  where: pred.and(
    pred.eq((row) => row.role, 'member'),
    pred.gt((row) => row.createdAt, Date.now() - 7 * 24 * 60 * 60 * 1000)
  ),
  orderBy: 'createdAt',
  order: 'desc',
  limit: 20,
});

await db.update(projects, pred.eq((row) => row.id, 42), { name: 'Project Mistfall' });
await db.delete(projects, pred.eq((row) => row.ownerId, 999));
```

`select()` accepts `QueryOptions` (`where`, `orderBy`, `order`, `limit`, `offset`). Predicates are plain functions, so you can roll your own or compose the helpers from `pred`.

## Transactions

```ts
await db.transaction([users, projects], async (trx) => {
  const [user] = await trx.insert(users, { email: 'new@example.com', displayName: 'New User' });
  await trx.insert(projects, { ownerId: user.id, name: 'Kickoff' });
});
```

Pass every table you plan to touch so the runtime can open a single IndexedDB transaction that covers the required object stores.

## In-memory adapter for SSR/tests

```ts
const db = await connect(appSchema, { adapter: 'memory' });
```

The memory adapter mirrors the IndexedDB behavior (auto-incrementing identities, FK checks, transactions) and is perfect for unit tests or non-browser runtimes.

## Migrations

Mistfall can inspect an existing IndexedDB database, diff it against your schema, and scaffold an upgrade script.

1. Ensure your schema is bundled to an ES module (e.g. `tsc schema.ts --outDir dist`).
2. Run the generator:
   ```bash
   node cli/generate-migration.mjs dist/schema.js
   ```
3. The CLI writes `migrations/<timestamp>_<schema>.mjs`. Inside your app, load and run it during `indexedDB.open()` upgrades:
   ```ts
   const request = indexedDB.open('mistfall-demo');
   request.onupgradeneeded = async (event) => {
     const db = request.result;
     const tx = request.transaction;
     const { default: migrate } = await import('./migrations/20241021_mistfall_demo.mjs');
     await migrate(db, tx!);
   };
   ```

Generated scripts create/drop tables and indexes to match the schema signature. If no differences are detected the CLI simply reports that the database is up to date.

## API surface

| Export | Description |
| --- | --- |
| `t.*` | Column builders (`int`, `varchar`, `json<T>()`, `timestamp`, etc.) + `index/uniqueIndex` helpers |
| `table(name, columns, indexes?)` | Defines a table and enforces a primary key |
| `schema(options, tables)` | Namespaces & versions the schema; `options.namespace` prefixes IndexedDB object store names |
| `connect(schema, opts?)` | Creates a `DatabaseClient`; opts: `{ dbName?: string; adapter?: 'auto' | 'memory' }` |
| `DatabaseClient` | `{ insert, select, update, delete, transaction, close }` returning typed payloads |
| `pred` | Predicate helpers `eq`, `neq`, `gt`, `lt`, `and`, `or` |
| `ColumnBuilder` methods | `notNull`, `primaryKey`, `unique`, `identity`, `default`, `$defaultFn`, `$onUpdate`, `references` |

## Development scripts

- `npm run build` – compile TypeScript to `dist/`
- `npm run dev` – watch mode rebuilds
- `npm run clean` – remove `dist/`

## License

MIT © Mistfall contributors
