---
title: Astro Integration Guide
description: Step-by-step instructions for installing Mistfall in an Astro app, wiring schemas, islands, adapters, and tests.
---

# Astro Integration Guide

This guide assumes you have an Astro project (plain Astro or Astro + React/Svelte). You will:

1. Install/use the Mistfall package.
2. Declare your schema once and export typed helpers.
3. Create a shared `getClient()` with smart adapter selection and seeding.
4. Consume the client in islands, API routes, and tests.
5. Handle migrations and hot reload.

## 1. Install Mistfall

```bash
npm install mistfall
```

> Working in this monorepo? Build the runtime inside `specs/` and `npm link mistfall` into your Astro app so Vite pulls the latest code.

## 2. Declare schema & tables

Create `src/lib/db/tables.ts` (or similar):

```ts
import { table, schema, t, index } from 'mistfall/builders';

export const users = table('users', {
  id: t.int().primaryKey().identity(),
  email: t.varchar({ length: 256 }).notNull().unique(),
  displayName: t.varchar({ length: 128 }).notNull(),
  createdAt: t.timestamp({ mode: 'number' }).$defaultFn(Date.now),
}, (tbl) => [
  index('users_email_idx').on(tbl.email),
]);

export const todos = table('todos', {
  id: t.int().primaryKey().identity(),
  title: t.varchar({ length: 256 }).notNull(),
  status: t.enum(['pending', 'in-progress', 'done']).default('pending'),
  ownerId: t.int().references(() => users.id).notNull(),
  updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(Date.now).$onUpdate(Date.now),
});

export const appSchema = schema({ name: 'mistfall-demo', version: 1 }, {
  users,
  todos,
});
```

- The schema name becomes your IndexedDB database name.
- Bump `version` when adding tables/indexes; see [Migrations](/foundations-migrations/).

## 3. Shared client helper

Create `src/lib/db/client.ts`:

```ts
import { connect } from 'mistfall/runtime';
import { appSchema, todos, users } from './tables';

let cached: Promise<Awaited<ReturnType<typeof connect>>> | null = null;

async function ensureClient() {
  if (!cached) {
    cached = connect(appSchema, {
      adapter: import.meta.env.SSR ? 'memory' : 'auto',
      dbName: 'mistfall-demo',
      onUpgrade(event) {
        console.info('Upgrading Mistfall DB', event.oldVersion, '→', event.newVersion);
      },
    });
  }
  return cached;
}

export async function getClient() {
  const client = await ensureClient();
  await seed(client); // idempotent seeding (defined below)
  return client;
}

async function seed(client: Awaited<ReturnType<typeof connect>>) {
  const rows = await client.select(users, { limit: 1 });
  if (rows.length) return;
  const [alice] = await client.insert(users, [{ email: 'alice@example.com', displayName: 'Alice' }]);
  await client.insert(todos, [{ title: 'Try Mistfall', ownerId: alice.id }]);
}

export const tables = { users, todos };
```

- Cache the promise so multiple islands reuse the same connection.
- `adapter` automatically uses IndexedDB in the browser and memory during SSR/tests.
- Seeding is optional but keeps demos deterministic.

## 4. Use Mistfall inside Astro islands

### React example (`src/components/TodoDashboard.tsx`):

```tsx
import { useEffect, useState } from 'react';
import { getClient, tables } from '../lib/db/client';

export function TodoDashboard() {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    let active = true;
    getClient().then(async (client) => {
      if (!active) return;
      const rows = await client.select(tables.todos, {
        orderBy: (row) => row.updatedAt,
        order: 'desc',
      });
      setTodos(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

Render it from an Astro page with `client:load` or `client:visible`:

```astro
---
import { TodoDashboard } from '../components/TodoDashboard';
---

<TodoDashboard client:load />
```

### Svelte example

```svelte
<script>
  import { onMount } from 'svelte';
  import { getClient, tables } from '../lib/db/client';
  let todos = [];
  onMount(async () => {
    const client = await getClient();
    todos = await client.select(tables.todos);
  });
</script>

<ul>
  {#each todos as todo}
    <li>{todo.title}</li>
  {/each}
</ul>
```

The same `getClient()` works regardless of frontend framework.

## 5. Server-side usage & API routes

Astro server routes (or `src/pages/api/*.ts`) run in Node where IndexedDB is unavailable. Force the memory adapter for deterministic behavior:

```ts
import type { APIRoute } from 'astro';
import { connect } from 'mistfall/runtime';
import { appSchema, tables } from '../../lib/db/tables';

export const GET: APIRoute = async () => {
  const client = await connect(appSchema, { adapter: 'memory' });
  const todos = await client.select(tables.todos);
  return new Response(JSON.stringify(todos));
};
```

If you need persistent data visible to browsers, perform writes in islands or edge functions that run within the user’s agent so IndexedDB is available.

## 6. Transactions & helpers

Keep complex flows encapsulated and call them from islands:

```ts
export async function reassignTodos(client, sourceId, targetId) {
  return client.transaction([tables.todos, tables.users], async (trx) => {
    const [target] = await trx.select(tables.users, { where: (row) => row.id === targetId, limit: 1 });
    if (!target) throw new Error('Target missing');

    await trx.update(tables.todos, (row) => row.ownerId === sourceId, {
      ownerId: targetId,
      status: 'in-progress',
      updatedAt: Date.now(),
    });

    return trx.select(tables.todos, { where: (row) => row.ownerId === targetId });
  });
}
```

In your component:

```tsx
await reassignTodos(client, sourceUserId, targetUserId);
```

## 7. Testing

Use Vitest with the memory adapter:

```ts
import { connect } from 'mistfall/runtime';
import { appSchema, tables } from '../src/lib/db/tables';

describe('todos', () => {
  let client;
  beforeEach(async () => {
    client = await connect(appSchema, { adapter: 'memory' });
    await client.insert(tables.todos, [{ title: 'Write tests', ownerId: 1 }]);
  });

  it('marks todo complete', async () => {
    await client.update(tables.todos, (row) => row.title === 'Write tests', { status: 'done' });
    const [todo] = await client.select(tables.todos, { limit: 1 });
    expect(todo.status).toBe('done');
  });
});
```

The memory adapter mirrors constraints (PK, FK, unique) so tests catch logic issues before hitting the browser.

## 8. Hot reload & rebuilding Mistfall

- When editing the Mistfall source (`specs/`), run `npm run build -- --watch` to regenerate `dist/`.
- Restart `npm run dev` in Astro if imports point to the local build output; Vite needs to see new files.
- If IndexedDB schema changes break local data, delete the database via DevTools → Application → IndexedDB.

## 9. Deployment checklist

- Ensure schema/exported helpers live in shared, importable modules (`src/lib/db/*`).
- Confirm `schema.version` matches your latest IndexedDB changes.
- Verify islands never call `getClient()` during SSR (only inside `client:*` directives).
- Use environment guards if you need different database names per environment (e.g., `mistfall-demo-dev`).

With these pieces you have a production-ready Astro integration: typed schemas, cached clients, safe adapters, and frictionless tests. Explore the [Todo demo](/todo-demo/) and [Ecommerce demo](/ecommerce-demo/) to see the patterns running live.
