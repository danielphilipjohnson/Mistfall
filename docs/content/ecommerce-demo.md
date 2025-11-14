# Ecommerce Demo

## Files
- `src/examples/ecommerce.ts` — schema + seeding + `checkoutCart` transaction helper.
- `zapping-zero/src/lib/db/ecommerce.ts` — helper to fetch paginated products via `limit`/`offset` + predicates.
- `zapping-zero/src/components/ProductPager.tsx` — React island showing storefront pagination.

## Schema Highlights
- Tables: `categories`, `products`, `customers`, `orders`, `orderItems`.
- Unique indexes on SKU, email, order number; FK relationships between orders/orderItems/products/customers.
- Decimal prices stored as strings to avoid floating-point issues.

## Transaction Example – Checkout
```ts
await client.transaction([orders, orderItems, products], async (trx) => {
  // 1. Select products, ensure inventory >= requested quantity.
  // 2. Update product inventory.
  // 3. Insert order with totals (subtotal/tax/total).
  // 4. Insert order_items rows referencing the order.
});
```
- Entire cart succeeds or fails atomically (insufficient inventory throws → auto rollback).

## Pagination Demo – ProductPager
- Uses `client.select(products, { where: pred.gt(row => row.inventory ?? 0, 0), orderBy: row => row.name, limit, offset })`.
- Tracks `nextCursor`/`prevCursor` to drive Prev/Next buttons in the UI.
- Great template for storefront browsing: swap filters for category, price, etc.

## Usage in Astro
- Import helpers from the package (or local `src/lib/db` copy during dev).
- Client island fetches a page on mount, updates state on button click.
- Because data is stored in IndexedDB, pagination persists between refreshes; you can seed once and re-use data offline.
