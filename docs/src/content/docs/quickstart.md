---
title: Mistfall Quickstart
description: Copy-paste setup for installing Mistfall, declaring a schema, wiring `getClient()`, and performing CRUD.
---

# Mistfall Quickstart

Follow these steps to go from empty Astro app to querying IndexedDB with Mistfall in under five minutes.

## 1. Install

```bash
npm install mistfall
```

> Working inside this repo? Build/link the local `specs/` package instead.

## 2. Declare tables + schema

Create `src/lib/db/tables.ts`:

```ts
import { table, schema, t } from 'mistfall/builders';

export const todos = table('todos', {
  id: t.int().primaryKey().identity(),
  title: t.varchar({ length: 256 }).notNull(),
  status: t.enum(['pending', 'done']).default('pending'),
  updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(Date.now).$onUpdate(Date.now),
});

export const appSchema = schema({ name: 'mistfall-demo', version: 1 }, { todos });
```

## 3. Shared client helper

Create `src/lib/db/client.ts`:

```ts
import { connect } from 'mistfall/runtime';
import { appSchema, todos } from './tables';

let cached: Promise<Awaited<ReturnType<typeof connect>>> | null = null;

async function ensureClient() {
  if (!cached) {
    cached = connect(appSchema, {
      adapter: import.meta.env.SSR ? 'memory' : 'auto',
    });
  }
  return cached;
}

export async function getClient() {
  const client = await ensureClient();
  await seed(client);
  return client;
}

async function seed(client: Awaited<ReturnType<typeof connect>>) {
  const existing = await client.select(todos, { limit: 1 });
  if (existing.length) return;
  await client.insert(todos, [{ title: 'Build with Mistfall' }]);
}

export { todos };
```

## 4. Use it in an Astro island

`src/components/TodoDashboard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getClient, todos } from '../lib/db/client';

export function TodoDashboard() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    getClient().then(async (client) => {
      if (!active) return;
      setItems(await client.select(todos));
    });
    return () => { active = false; };
  }, []);

  return (
    <ul>
      {items.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

Render it from `src/pages/index.astro`:

```astro
---
import { TodoDashboard } from '../components/TodoDashboard';
---

<TodoDashboard client:load />
```

## 5. Perform CRUD

```ts
const client = await getClient();
await client.insert(todos, { title: 'Ship docs' });
await client.update(todos, (row) => row.status === 'pending', { status: 'done' });
await client.delete(todos, (row) => row.title === 'Build with Mistfall' });
```

Thanks to the schema DSL, all operations are fully typed.

## 6. Tests / SSR

Use the same schema with the memory adapter:

```ts
const client = await connect(appSchema, { adapter: 'memory' });
```

## Next steps

- Dive deeper into [Working with Schema](/working-with-schema/).
- Learn more about adapters and client wiring in [Connecting to Mistfall](/foundations-connecting/).
- Explore end-to-end flows in the [Todo demo](/todo-demo/) or [Ecommerce demo](/ecommerce-demo/).
