---
description: "While the DSL/runtime focuses on additive, forward-only schema changes, you can manage IndexedDB migrations today by bumping schema versions and optionally running custom upgrade steps. This guide explains how."
title: Migrations & Schema Versioning
---

While the DSL/runtime focuses on additive, forward-only schema changes, you can manage IndexedDB migrations today by bumping schema versions and optionally running custom upgrade steps. This guide explains how.

## 1. Versioned Schemas
`schema({ name: 'todo-dashboard', version: 1 }, { users, todos })`

- `version` maps directly to the IndexedDB database version.
- When you bump from `1` to `2`, the runtime triggers `onupgradeneeded`, recreates missing stores/indexes, and writes metadata to `__meta` (`key: 'schema'`, `signature`, `upgradedAt`).
- The default upgrader handles **additive** changes: new tables, new columns with defaults, new indexes.

## 2. Making Additive Changes
1. Update your table definitions (add column/index defaulted to safe value).
2. Bump the schema version:
   ```ts
   export const todoSchema = schema({ name: 'todo-dashboard', version: 2 }, { users, todos });
   ```
3. Rebuild the package (`npm run build`).
4. Reload the app; IndexedDB runs `upgradeDatabase`, creating new object stores/indexes as needed.
5. Seed or backfill data inside application code after the upgrade if necessary.

### Example: Add `priority` Column
```ts
export const todos = table('todos', {
  // existing columns...
  priority: t.enum(['low','medium','high'] as const).default('medium'),
});
```
- Because the column has a default, existing rows can adopt it automatically when you re-save them.

## 3. Custom Upgrade Logic
For non-trivial changes (data transforms, backfills), hook into `upgradeDatabase` by running your own logic after `connect`. Pattern:

```ts
await connect(schema, { dbName }).then(async (client) => {
  const meta = await client.select(metaTable); // read __meta store if you expose it
  if (meta.version < 2) {
    await runBackfill(client);
  }
});
```

Or extend the runtime to register migration callbacks:

```ts
const migrations = new Map<number, (db: IDBDatabase, tx: IDBTransaction) => void>();
migrations.set(2, (db, tx) => {
  const store = tx.objectStore('namespace__stats');
  if (!store.indexNames.contains('statDefId')) store.createIndex('statDefId', 'statDefId');
});
```
Then call these inside `upgradeDatabase` (see `src/runtime.ts`) before the metadata write. This matches the pattern shown in your previous app snippet.

## 4. Breaking Changes
IndexedDB doesn’t support dropping columns or shrinking stores without destructive upgrades. Recommended approach:
- Bump version.
- In `onupgradeneeded`, delete/recreate stores if you can afford data loss, or rename the database (namespace) and perform a manual data migration via export/import.
- Communicate to users when an upgrade wipes local data.

## 5. Migration Checklist
- [ ] Decide whether the change is additive. If yes, use default upgrader.
- [ ] Bump schema version and rebuild.
- [ ] Include defaults for new columns to keep insert/update types happy.
- [ ] If you need custom steps, extend `upgradeDatabase` to run additional index creation/backfills wrapped in try/catch (IDB throws if an index already exists).
- [ ] Test the upgrade path by loading the old version in the browser, then rebuilding with the new version and reloading to ensure `onupgradeneeded` fires.

## 6. Testing Upgrades
1. Run the app at version 1; insert some data.
2. Stop the dev server; change schema to version 2.
3. Start the server, reload the page. In DevTools → Application → IndexedDB you should see the new indexes/stores.
4. Verify data is still accessible and new columns behave as expected.

## 7. Future Enhancements
The SPEC includes “Should Have” migrations (detect schema changes, auto-upgrade). For now, manual control via version bumps + optional custom logic gives you predictable upgrades. When more advanced tooling lands (diff detection, automated data transforms), this document will be updated.

---
Use this guide whenever you evolve your schema, ensuring you bump versions and provide safe defaults/backfills so existing IndexedDB data keeps working.
