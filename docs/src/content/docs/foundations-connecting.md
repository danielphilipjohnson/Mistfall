---
title: Connecting to Mistfall
description: How to instantiate the Mistfall database client, pick adapters, and seed data across SSR and browser environments.
---

# Connecting to Mistfall

Once your schema is defined you need a single place to create the client, pick adapters, and seed data. Use this guide alongside [Working with Schema](/working-with-schema/) to keep runtime wiring consistent across apps, demos, and tests.

## Build the schema once

```ts
import { schema } from 'mistfall/builders';
import { users, todos } from './tables';

export const appSchema = schema({ name: 'mistfall-demo', version: 1 }, {
  users,
  todos,
});
```

- Export the schema so every layer (pages, islands, tests) references the same metadata.
- Bump `version` when you add tables/indexes so IndexedDB migrations run automatically.

## Create a reusable client helper

```ts
import { connect } from 'mistfall/runtime';
import { appSchema } from './schema';
import { seedTodoData } from './seed';

let cached: ReturnType<typeof connect> | null = null;

export async function getClient() {
  if (!cached) {
    cached = connect(appSchema, {
      adapter: import.meta.env.SSR ? 'memory' : 'auto',
      dbName: 'mistfall-demo',
    });
  }
  const client = await cached;
  await seedTodoData(client);
  return client;
}
```

Best practices:
- Cache the promise so multiple components reuse the same connection.
- Use `adapter: 'memory'` for SSR/tests; `auto` picks IndexedDB in browsers.
- Keep seeding idempotent so re-running `getClient()` doesn’t duplicate rows.

## Lazy connections in Astro islands

```tsx
useEffect(() => {
  let active = true;
  getClient().then((client) => {
    if (!active) return;
    client.select(todos).then(setTodos);
  });
  return () => {
    active = false;
  };
}, []);
```

- Call `getClient()` inside `useEffect`/`onMount` so IndexedDB access stays client-only.
- For SSR components, request `{ adapter: 'memory' }` explicitly to avoid browser APIs.

## Handling upgrades

```ts
await connect(appSchema, {
  onUpgrade(event) {
    console.info('Upgrading from', event.oldVersion, 'to', event.newVersion);
  },
});
```

Use `onUpgrade` when you need to populate new stores, copy data, or clean up indexes during a version bump.

## Tests and Node scripts

```ts
const client = await connect(appSchema, { adapter: 'memory' });
await seedTodoData(client);

afterEach(() => client.reset());
```

- Memory adapter mirrors the same constraints but stays in-process.
- Reset the client (or re-create it) between tests for isolation.

With schema fundamentals plus these connection patterns you can move between demos, Astro islands, and automated tests without rewriting boilerplate. Pair this with the [Astro Integration guide](/integrations/astro/) for framework-specific examples.
