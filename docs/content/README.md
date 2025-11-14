# IndexedDB Drizzle-like DSL — Documents & Examples

This folder collects docs, guides, and runnable snippets showing how to use the schema DSL, runtime adapters, predicates, transactions, and the demo apps (Todo + Ecommerce) in Astro.

## Contents

- `overview.md` — high-level architecture, supported types/modifiers, adapters, and migration story.
- `api-reference.md` — quick cheatsheet for builders (`t.*`, `table`, `index`), runtime methods (`connect`, CRUD, `transaction`), and predicate helpers.
- `integrations/astro.md` — how to consume the package inside Astro (SSR-safe entry, client islands, memory adapter for tests).
- `todo-demo.md` — schema/transaction walkthrough.
- `ecommerce-demo.md` — storefront schema, checkout transaction, and pagination.
- `tutorials/full-guide.md` — comprehensive tutorial covering DSL → runtime → Astro integration.
- `tutorials/tables-and-columns.md` — deep dive into every column builder, modifier, and table-level option.
- `tutorials/querying.md` — exhaustive coverage of select/update/delete options, predicates, ordering, and pagination.
- `foundations-migrations.md` — explains schema versioning, additive upgrades, and how to hook custom migration logic.
- `demos/` — self-contained feature demos:
  - `schema-dsl.md`
  - `runtime-crud.md`
  - `predicates.md`
  - `transactions.md`
  - `pagination.md`
  - `adapters.md`

> Next up: a full step-by-step Todo tutorial will live alongside these docs once all feature demos are finalized.

Each doc links back to the relevant files under `src/` and `zapping-zero/` so you can copy/paste code into your own project.
