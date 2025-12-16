---
title: Overview
description: High-level goals, architecture layers, adapters, and example entry points for the Mistfall IndexedDB toolkit.
---

## Goals
- Drizzle-style schema DSL: strongly typed `table()` + `t.*` column builders that emit a schema AST.
- Runtime compilation to IndexedDB stores + sequences + metadata with SSR-safe fallbacks.
- Same API available in-memory for tests/SSR and IndexedDB for browsers.

## Layers
1. **AST/Builders (`src/ast.ts`, `src/builders.ts`)**
   - Scalars: `t.int`, `t.varchar`, `t.enum`, `t.json`, etc.
   - Modifiers: `.primaryKey()`, `.identity()`, `.notNull()`, `.unique()`, `.default(value)`, `$defaultFn`, `$onUpdate`, `.references(() => table.column)`.
   - Indexes: `index('name').on(table.column)`, `uniqueIndex`, computed indexes.
2. **Runtime (`src/runtime.ts`)**
   - `connect(schema, { adapter?: 'auto' | 'memory' })`
   - CRUD: `insert`, `select`, `update`, `delete` all run in IDB transactions.
   - `transaction(tables, fn)` gives you a scoped session for multi-store atomic work.
   - Built-in metadata (`__meta`, `__seq`) and FK/PK enforcement.
3. **Predicates (`src/predicates.ts`)**
   - `pred.eq`, `pred.gt`, `pred.and`, `pred.or`, `pred.lt` for query filters.

## Adapters
- **IndexedDB** (default in browser): real object stores, indexes, sequences. Automatically handles migrations for additive schema changes.
- **Memory** (`adapter: 'memory'` or SSR environments): stores data in JS Maps, mirrors the same checks, great for tests.

## Examples
- `src/examples/todo.ts` – Todo schema + seeding + `reassignTodos` transaction.
- `src/examples/ecommerce.ts` – Ecommerce schema + seeding + `checkoutCart` transaction.
- `zapping-zero/` – Astro demo that imports both examples and shows queries, transactions, pagination.
