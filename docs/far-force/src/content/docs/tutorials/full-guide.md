---
description: "This end-to-end guide walks through every feature exposed to users: schema DSL, runtime CRUD, predicates, transactions, pagination, adapters, and Astro integration. By the end you will have a working Todo dashboard plus pointers for expanding into ecommerce-style flows."
title: "Full Tutorial: Build a Browser-Native Todo Dashboard with the IndexedDB DSL"
---

# Full Tutorial: Build a Browser-Native Todo Dashboard with the IndexedDB DSL

This end-to-end guide walks through every feature exposed to users: schema DSL, runtime CRUD, predicates, transactions, pagination, adapters, and Astro integration. By the end you will have a working Todo dashboard plus pointers for expanding into ecommerce-style flows.

## Prerequisites
- Node 18+
- Astro (or any Vite framework) for the demo UI
- This repo cloned locally (or install the package once published)

```
# inside your Astro project
git clone <repo> indexedb-drizzle
cd indexedb-drizzle/specs
npm install
npm run build
```

## 1. Declare the Schema (DSL)
Create `src/examples/todo.ts` (already in the repo) with tables + indexes:

```ts
export const users = table('users', {
  id: t.int().primaryKey().identity(),
  email: t.varchar({ length: 256 }).notNull().unique(),
  role: t.enum(['admin', 'member', 'guest'] as const).default('member'),
  createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
}, (cols) => [t.uniqueIndex('users_email_idx').on(cols.email)]);

export const todos = table('todos', {
  id: t.int().primaryKey().identity(),
  title: t.varchar({ length: 256 }).notNull(),
  status: t.enum(['pending', 'in-progress', 'done'] as const).default('pending'),
  ownerId: t.int().references(() => users.id).notNull(),
  dueAt: t.timestamp({ mode: 'number' }),
  updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
}, (cols) => [index('todos_owner_idx').on(cols.ownerId)]);

export const todoSchema = schema({ name: 'todo-dashboard', version: 1 }, { users, todos });
```

Highlights:
- Chain `primaryKey`, `identity`, `notNull`, `default`, `$defaultFn`, `$onUpdate`.
- Use `references` to enforce FK integrity.
- Attach indexes via `index()`/`uniqueIndex()`.

## 2. Seed Data
Add a helper next to the schema:

```ts
export async function seedTodoData(client: DatabaseClient<typeof todoSchema>) {
  const existing = await client.select(users);
  if (existing.length) return;
  const [alice, bob] = await client.insert(users, [
    { email: 'alice@example.com', displayName: 'Alice', role: 'admin' },
    { email: 'bob@example.com', displayName: 'Bob', role: 'member' },
  ]);
  await client.insert(todos, [
    { title: 'Draft onboarding docs', ownerId: alice.id, status: 'in-progress', dueAt: Date.now() + 3 * 864e5 },
    { title: 'Ship Astro dashboard', ownerId: bob.id, status: 'pending' },
  ]);
}
```

## 3. Connect to the Runtime
In your Astro project create `src/lib/db/schema.ts`:

```ts
import { connect } from 'indexedb-drizzle';
import { todoSchema, seedTodoData, todos, users } from 'indexedb-drizzle/dist/examples/todo.js';

export async function getClient() {
  const client = await connect(todoSchema); // IndexedDB in browser, memory on SSR
  await seedTodoData(client);
  return client;
}

export const tables = { todos, users };
```

Tips:
- Omit `adapter` to let the runtime pick IndexedDB in the browser.
- Pass `{ adapter: 'memory' }` inside tests/SSR entrypoints when IndexedDB is unavailable.

## 4. CRUD + Predicates
Create a React island (`src/components/TodoDashboard.tsx`):

```tsx
const [todos, setTodos] = useState<Todo[]>([]);
useEffect(() => {
  let active = true;
  getClient().then(async (client) => {
    const rows = await client.select(tables.todos, {
      where: pred.eq((row) => row.status, filterStatus),
      orderBy: (row) => row.updatedAt,
      order: 'desc',
    });
    if (active) setTodos(rows);
  });
  return () => { active = false; };
}, [filterStatus]);
```

- Use predicate helpers (`pred.eq`, `pred.gt`, `pred.and`) for clarity.
- `orderBy`, `order`, `limit`, `offset` support pagination.

## 5. Transactions
Wrap multi-table work with `transaction()` to keep updates atomic:

```ts
export async function reassignTodos(client, sourceId, targetId, todoIds) {
  return client.transaction([users, todos], async (trx) => {
    const ids = new Set(todoIds);
    const [target] = await trx.select(users, { where: (row) => row.id === targetId, limit: 1 });
    if (!target) throw new Error('Target missing');

    const selected = await trx.select(todos, { where: (row) => ids.has(row.id) });
    if (selected.some((todo) => todo.ownerId !== sourceId)) throw new Error('Invalid owners');

    await trx.update(todos, (row) => ids.has(row.id), {
      ownerId: targetId,
      status: 'in-progress',
      updatedAt: Date.now(),
    });

    return trx.select(todos, { where: (row) => ids.has(row.id) });
  });
}
```

## 6. Pagination Demo
Use `limit` + `offset` to page products (see `zapping-zero/src/lib/db/ecommerce.ts`):

```ts
const page = await client.select(products, {
  where: pred.gt((row) => row.inventory ?? 0, 0),
  orderBy: (row) => row.name.toLowerCase(),
  offset: cursor,
  limit,
});
```

In React (`ProductPager.tsx`), track `cursor` in state and call the helper when buttons are pressed.

## 7. Adapter Awareness
- Default `connect(schema)` ➜ IndexedDB in browser, memory on SSR (auto-detects `indexedDB`).
- Force memory for deterministic unit tests: `connect(schema, { adapter: 'memory' })`.
- Force IndexedDB with custom name: `connect(schema, { adapter: 'auto', dbName: 'demo-db' })`.

## 8. Astro Wiring
`src/pages/index.astro`:

```astro
<TodoDashboard client:load />
<QueryShowcase client:load />
<ProductPager client:load />
```

- Each component runs entirely in the browser; server-rendered HTML just hydrates placeholders.
- Hot reload picks up changes to the DSL as long as you rebuild the package (`npm run build` in `specs`).

## 9. Testing
Use the memory adapter in Vitest:

```ts
const client = await connect(todoSchema, { adapter: 'memory' });
await seedTodoData(client);
expect(await client.select(todos)).toHaveLength(2);
```

## 10. Extend Further
- Add ecommerce checkout (`src/examples/ecommerce.ts`) to see transactions spanning 3 tables.
- Write migrations by bumping `schema.version` and letting `upgradeDatabase` create new stores/indexes.
- Copy the `ProductPager` pattern to any other table: the runtime handles limit/offset + predicates consistently.

---
This tutorial references everything currently available: schema DSL, runtime CRUD, predicates, transactions, pagination, adapters, and Astro integration. Use it as the canonical onboarding doc until additional tutorials (e.g., deep-dive Todo series) are published.
