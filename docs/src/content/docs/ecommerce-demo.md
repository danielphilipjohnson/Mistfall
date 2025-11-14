---
title: Ecommerce Demo
description: Deep dive into Mistfall’s ecommerce sample—schema design, checkout transaction, pagination UI, and extension ideas.
---

# Ecommerce Demo

The ecommerce sample illustrates a multi-table Mistfall app: catalog browsing, cart checkout, and basic analytics. Use it as a blueprint for any storefront or inventory-heavy feature set.

## Where everything lives

| File | Purpose |
| --- | --- |
| `src/examples/ecommerce.ts` | Source-of-truth schema, seed data, and helpers (`checkoutCart`, `fetchProducts`). |
| `zapping-zero/src/lib/db/ecommerce.ts` | Runtime wrapper used by the Astro demo (pagination helper, checkout bridge). |
| `zapping-zero/src/components/ProductPager.tsx` | React island that renders the catalogue with Prev/Next pagination. |
| `zapping-zero/src/components/CheckoutPanel.tsx` | Simulated checkout UI that calls the transaction helper. |

## Schema walkthrough

```ts
export const categories = table('categories', {
  id: t.int().primaryKey().identity(),
  name: t.varchar({ length: 64 }).notNull().unique(),
});

export const products = table('products', {
  id: t.int().primaryKey().identity(),
  categoryId: t.int().references(() => categories.id).notNull(),
  sku: t.varchar({ length: 32 }).notNull().unique(),
  name: t.varchar({ length: 256 }).notNull(),
  priceCents: t.decimal({ precision: 12, scale: 2, mode: 'string' }).notNull(),
  inventory: t.int().default(0),
}, (tbl) => [
  index('products_category_idx').on(tbl.categoryId),
]);

export const customers = table('customers', {
  id: t.int().primaryKey().identity(),
  email: t.varchar({ length: 256 }).notNull().unique(),
  displayName: t.varchar({ length: 128 }).notNull(),
});

export const orders = table('orders', {
  id: t.int().primaryKey().identity(),
  customerId: t.int().references(() => customers.id).notNull(),
  orderNumber: t.varchar({ length: 24 }).notNull().unique(),
  subtotalCents: t.decimal({ precision: 12, scale: 2, mode: 'string' }).notNull(),
  taxCents: t.decimal({ precision: 12, scale: 2, mode: 'string' }).notNull(),
  totalCents: t.decimal({ precision: 12, scale: 2, mode: 'string' }).notNull(),
  createdAt: t.timestamp({ mode: 'number' }).$defaultFn(Date.now),
});

export const orderItems = table('order_items', {
  id: t.int().primaryKey().identity(),
  orderId: t.int().references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  productId: t.int().references(() => products.id).notNull(),
  quantity: t.int().notNull(),
  lineTotalCents: t.decimal({ precision: 12, scale: 2, mode: 'string' }).notNull(),
});
```

Highlights:
- Prices stored as strings via `t.decimal(..., mode: 'string')` to avoid floating point bugs.
- Inventory tracked per product with an index on `categoryId` for quick filtering.
- `order_items` cascades when the parent order is removed.

## Seed data

`seedEcommerceData(client)` populates categories, 15+ products, demo customers, and a handful of historical orders. Run it once per browser session so pagination feels real without needing a server.

```ts
export async function seedEcommerceData(client: DatabaseClient<typeof ecommerceSchema>) {
  const existing = await client.select(products, { limit: 1 });
  if (existing.length) return;
  const categoryMap = await createCategories(client);
  await createProducts(client, categoryMap);
  await createCustomersAndOrders(client);
}
```

## Checkout transaction

The heart of the demo is `checkoutCart`, which enforces inventory and writes all order rows atomically:

```ts
export async function checkoutCart(client, input: CheckoutInput) {
  return client.transaction([orders, orderItems, products], async (trx) => {
    const items = await Promise.all(
      input.items.map(async (item) => {
        const [product] = await trx.select(products, {
          where: (row) => row.id === item.productId,
          limit: 1,
        });
        if (!product) throw new Error('Product missing');
        if ((product.inventory ?? 0) < item.quantity) throw new Error('Inventory shortfall');
        return { product, quantity: item.quantity };
      }),
    );

    const { subtotal, tax, total } = calculateTotals(items);

    const [order] = await trx.insert(orders, [{
      customerId: input.customerId,
      orderNumber: generateOrderNumber(),
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: total,
    }]);

    await trx.insert(orderItems, items.map(({ product, quantity }) => ({
      orderId: order.id,
      productId: product.id,
      quantity,
      lineTotalCents: multiply(product.priceCents, quantity),
    })));

    await Promise.all(items.map(({ product, quantity }) =>
      trx.update(products, (row) => row.id === product.id, {
        inventory: (product.inventory ?? 0) - quantity,
      })
    ));

    return order;
  });
}
```

- Any thrown error (inventory mismatch, missing customer) rolls back the entire transaction.
- `calculateTotals` keeps pricing logic centralized and testable.
- Because it runs in IndexedDB, checkout is instant and works offline; sync with a backend later if needed.

## Pagination helper

`zapping-zero/src/lib/db/ecommerce.ts` exposes a helper consumed by the React island:

```ts
const PAGE_SIZE = 6;

export async function fetchProductPage({ cursor = 0, categoryId }: { cursor?: number; categoryId?: number }) {
  const client = await getClient();
  const rows = await client.select(products, {
    where: categoryId
      ? pred.eq((row) => row.categoryId, categoryId)
      : pred.gt((row) => row.inventory ?? 0, 0),
    orderBy: (row) => row.name.toLowerCase(),
    order: 'asc',
    limit: PAGE_SIZE,
    offset: cursor,
  });

  return {
    items: rows,
    nextCursor: rows.length === PAGE_SIZE ? cursor + PAGE_SIZE : null,
    prevCursor: cursor > 0 ? Math.max(0, cursor - PAGE_SIZE) : null,
  };
}
```

### React island

```tsx
const [cursor, setCursor] = useState(0);
const [page, setPage] = useState({ items: [], nextCursor: null, prevCursor: null });

useEffect(() => {
  let active = true;
  fetchProductPage({ cursor }).then((data) => {
    if (active) setPage(data);
  });
  return () => { active = false; };
}, [cursor]);
```

Buttons simply call `setCursor(page.nextCursor ?? cursor)` or `setCursor(page.prevCursor ?? 0)`.

## How to extend the demo

1. **Add filters.** Index `priceCents` or `name` and expose additional predicate helpers for price bands or search queries.
2. **Persist carts.** Declare a `cartItems` table keyed by `customerId`. Because Mistfall already handles transactions, upgrading checkout is trivial.
3. **Sync to a backend.** Emit events after successful transactions and push them to a server via Fetch/WebSockets.
4. **Analytics.** Build aggregates (total revenue per day) using Mistfall queries or computed indexes.

## Adapter considerations

- Default adapter auto-detects IndexedDB in browsers and falls back to memory on SSR. That means the storefront works offline while tests remain deterministic.
- When writing Playwright tests, call `connect(schema, { adapter: 'memory' })` to simulate checkout entirely in Node.

## Related docs

- [Querying Data](/foundations-querying/) – deep dive into predicates and pagination.
- [Migrations](/foundations-migrations/) – bump the schema version when the ecommerce tables evolve.
- [Integrations → Astro](/integrations/astro/) – how the demo islands hook into Astro’s `client:load`.
