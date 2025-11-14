---
description: "Two demos show multi-store atomic work."
title: Transactions Demo
---

# Transactions Demo

Two demos show multi-store atomic work.

## 1. Todo Reassignment (`src/examples/todo.ts` & `zapping-zero/src/lib/db/demoQueries.ts`)
```ts
await client.transaction([users, todos], async (trx) => {
  const [targetUser] = await trx.select(users, { where: (row) => row.id === targetId, limit: 1 });
  if (!targetUser) throw new Error('Target missing');

  const selected = await trx.select(todos, { where: (row) => ids.has(row.id) });
  if (selected.some((todo) => todo.ownerId !== sourceId)) {
    throw new Error('Todos must belong to source user');
  }

  await trx.update(todos, (row) => ids.has(row.id), {
    ownerId: targetId,
    status: 'in-progress',
    updatedAt: Date.now(),
  });
});
```
- Validates all rows, updates them inside a single IndexedDB transaction.
- The Astro QueryShowcase prints the reassigned rows so you can see the result.

## 2. Ecommerce Checkout (`src/examples/ecommerce.ts`)
```ts
await client.transaction([orders, orderItems, products], async (trx) => {
  for (const item of cart) {
    const [product] = await trx.select(products, { where: (row) => row.id === item.productId, limit: 1 });
    if (!product || product.inventory! < item.quantity) throw new Error('Inventory issue');
    await trx.update(products, (row) => row.id === product.id, { inventory: product.inventory! - item.quantity });
  }

  const [order] = await trx.insert(orders, { ...totals });
  await trx.insert(orderItems, mappedLines(order.id));
});
```
- Adjusts inventory, inserts an order, then inserts order_items. Any thrown error rolls everything back.

## How to Run
- Todo: open the Astro app; QueryShowcase runs `reassignTodos` inside `runDemoQueries`.
- Ecommerce: import `checkoutCart` from `src/examples/ecommerce.ts` (or the built dist file) and call it from a client component or script. Pair it with the ProductPager to visualize inventory changes.

## Notes
- Declare every table you plan to touch in the first argument to `transaction()` so the runtime can open a single multi-store transaction.
- In memory adapter mode, the runtime snapshots stores and sequences; any thrown error restores the previous state.
