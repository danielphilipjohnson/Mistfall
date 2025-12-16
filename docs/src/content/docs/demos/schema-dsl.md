---
description: "This demo shows how to declare tables, columns, modifiers, and indexes using the Drizzle-like builders."
title: Schema DSL Demo
---

This demo shows how to declare tables, columns, modifiers, and indexes using the Drizzle-like builders.

## Files Involved
- `src/examples/todo.ts` — compact example with `users` and `todos` tables.
- `src/examples/ecommerce.ts` — larger schema with multiple tables and relationships.

## Key Concepts
```ts
import { table, t, index, uniqueIndex } from 'mistfall/builders';

export const users = table(
  'users',
  {
    id: t.int().primaryKey().identity(),
    email: t.varchar({ length: 256 }).notNull().unique(),
    role: t.enum(['admin','member','guest'] as const).default('member'),
    createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (cols) => [uniqueIndex('users_email_idx').on(cols.email)]
);
```
- Chain modifiers directly on each `t.*` builder.
- Add optional `references(() => otherTable.column)` to enforce FKs.
- Provide a third argument to `table()` to declare indexes.

## How to Try It
1. Open `src/examples/todo.ts` and tweak columns/indexes.
2. Run `npm run build` to ensure the schema types still compile.
3. Import the table into the Astro demo (`zapping-zero/src/lib/db/todo.ts`) or your own app and call `connect(schema)` to materialize it.

## Tips
- Use `schema({ name: 'app', version: 1 }, { users, todos })` to register tables and enable migrations.
- Every table must include at least one `.primaryKey()` column; the builder enforces this at runtime.
