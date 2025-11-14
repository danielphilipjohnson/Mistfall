---
title: Getting Started
description: Install Mistfall, explore the repo layout, and run the demos locally in minutes.
---

# Getting Started

Whether you want to try the Mistfall framework in an existing Astro app or explore the bundled demos, this quickstart walks through installation, wiring, and local development.

## 1. Install the Mistfall package

Inside your Astro (or Vite) project run:

```bash
npm install mistfall
```

If you’re working from this repo before the package is published, build the local source once and link it:

```bash
cd specs
npm install
npm run build
npm link

cd ../zapping-zero
npm link mistfall
```

That exposes the same runtime the docs use.

## 2. Scaffold your first schema

```ts
// src/lib/db/schema.ts
import { table, schema, t } from 'mistfall/builders';
import { connect } from 'mistfall/runtime';

const todos = table('todos', {
  id: t.int().primaryKey().identity(),
  title: t.varchar({ length: 256 }).notNull(),
  status: t.enum(['pending', 'done']).default('pending'),
});

export const appSchema = schema({ name: 'mistfall-demo', version: 1 }, { todos });

export async function getClient() {
  return connect(appSchema, { adapter: import.meta.env.SSR ? 'memory' : 'auto' });
}
```

Mount `getClient()` inside an Astro island (see [Connecting to Mistfall](/foundations-connecting/)) and you’re ready to call `insert`/`select` from the browser.

## 3. Run the Mistfall docs + demo app

```bash
cd docs/far-force
npm install
npm run dev
```

- Opens the Starlight docs/demos at `http://localhost:4321`.
- Sidebar pages explain every feature; demo sections import the live package so you can inspect IndexedDB behavior in devtools.
- Use `npm run dev -- --open` to auto-launch your browser.

## 4. Repository layout

```
.
├── astro.config.mjs          # Starlight config + sidebar
├── src/content/docs          # Docs & Foundations pages
├── src/content/docs/demos    # Feature deep dives (schema, CRUD, transactions…)
├── specs/                    # Mistfall runtime source + build output
└── zapping-zero/             # Astro demo app consuming Mistfall
```

When you update runtime code, run `npm run build -- --watch` inside `specs/` so `zapping-zero` refreshes immediately.

## 5. Suggested workflow

1. Start `npm run dev` (docs) and `npm run dev` inside `zapping-zero` side by side.
2. Edit runtime or schema builders in `specs/`; rebuild with `npm run build -- --watch`.
3. Document new behavior under `src/content/docs` so the splash/Foundations pages stay current.
4. Commit runtime + docs changes together.

## 6. Troubleshooting

- **“Missing frontmatter” errors** → ensure every Markdown file in `src/content/docs` begins with `---` + `title` + `description`.
- **Schema drift** → bump `schema.version` and follow the [Migrations guide](/foundations-migrations/).
- **IndexedDB cache conflicts** → delete the `mistfall-demo` database under Application → IndexedDB.
- **SSR failures** → use `adapter: 'memory'` wherever `window` is unavailable.

Next steps: skim the [Product Overview](/overview/), then dive into [Foundations](/working-with-schema/) for schema, connections, querying, and migrations.
