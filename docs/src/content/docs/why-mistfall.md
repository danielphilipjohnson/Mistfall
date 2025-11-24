---
title: Why Mistfall
description: IndexedDB without the footguns—learn the pain points we solve and how the framework improves developer and user experiences.
---

IndexedDB is the only persistent database built into every browser, yet the raw API is verbose, untyped, and difficult to evolve. Mistfall wraps it in a Drizzle-inspired schema DSL, a typed runtime, and a docs-first demo suite so you can ship offline-friendly features without fighting the platform.

## Pain points we address

### 1. Schemas are implicit
- Native IndexedDB forces you to juggle object store names, key paths, and `onupgradeneeded` scripts by hand.
- Mistfall lets you declare tables with `table()` + `t.*` builders, mirroring relational schema definitions.
- Types flow from schema to runtime, so client code knows exactly which columns exist and which are nullable.

### 2. Boilerplate-heavy transactions
- Vanilla APIs need nested request callbacks just to insert a row in a transaction.
- Mistfall exposes `client.insert/select/update/delete` plus `transaction()` with async/await semantics, enforcing FK/unique constraints in both IndexedDB and memory adapters.

### 3. Unreliable migrations
- Keeping upgrade scripts in sync with schema changes is error-prone, especially across multiple teams or demos.
- Mistfall stores schema metadata, auto-creates new stores/indexes for additive changes, and offers an `onUpgrade` hook for custom data migrations.

### 4. Testing & SSR gaps
- IndexedDB isn’t available in SSR or test runners without mocks.
- Mistfall’s memory adapter mirrors constraints and APIs, so the same schema runs in Node, Vitest, and the browser.

### 5. Hard-to-share recipes
- Most IndexedDB tutorials stop at “open a store.” They don’t cover end-to-end flows or UI patterns.
- Mistfall ships with two complete demo apps (Todo + Ecommerce) plus docs for schema, CRUD, predicates, pagination, adapters, and migrations—all synced with real code.

## What you get out of the box

| Feature | Problem solved |
| --- | --- |
| **Schema DSL** | Replace ad-hoc object store definitions with typed builders, indexes, and FK relationships. |
| **Typed runtime** | CRUD helpers + predicates keep data operations type-safe and easy to audit. |
| **Adapters** | Automatic IndexedDB vs. memory selection makes SSR/tests first-class. |
| **Docs + demos** | Every concept is paired with runnable samples so you can copy/paste into your app. |
| **Astro integration** | Prebuilt guidance for connecting schemas to Astro islands while avoiding SSR pitfalls. |

## When to pick Mistfall

- You need offline persistence, fast reloads, or background sync in the browser.
- You like Drizzle or Prisma ergonomics and want them in IndexedDB.
- You want to prototype in-memory, then deploy to real browsers without rewriting code.
- You’re building a docs site, SDK, or demo where showing runnable IndexedDB examples matters.

## When not to

- Your app only needs transient state (localStorage or React state may be enough).
- You already depend on a cross-platform database (SQLite/WebSQL/WebAssembly) and don’t need IndexedDB.

Mistfall meets browsers where they are—no extensions, no service worker gymnastics—while keeping developer experience polished. Continue with the [Getting Started guide](/getting-started/) to install the framework or explore the [Foundations](/working-with-schema/) docs to dive deeper.
