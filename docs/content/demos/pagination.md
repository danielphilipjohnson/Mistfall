# Pagination & Limit/Offset Demo

The ProductPager component illustrates limit/offset pagination plus predicates.

## Files
- `zapping-zero/src/lib/db/ecommerce.ts` — `fetchProductPage({ cursor, limit })` helper.
- `zapping-zero/src/components/ProductPager.tsx` — React island calling the helper.

## Helper Logic
```ts
const queryOptions = {
  where: pred.gt((row) => row.inventory ?? 0, 0),
  orderBy: (row) => row.name.toLowerCase(),
  offset: cursor,
  limit,
};
const rows = await client.select(products, queryOptions);
const nextCursor = rows.length === limit ? cursor + limit : null;
```
- `offset` and `limit` slice the result set.
- The helper returns `nextCursor`/`prevCursor` so the UI knows which page to fetch next.

## UI Logic
```tsx
const [cursor, setCursor] = useState(0);
const [items, setItems] = useState<Product[]>([]);
useEffect(() => {
  fetchProductPage({ cursor, limit: PAGE_SIZE }).then(setPage);
}, [cursor]);
```
- Buttons call `setCursor(nextCursor)` / `setCursor(prevCursor)`.
- Works with IndexedDB (default) or memory adapter (SSR/tests).

## Trying It
1. Run `npm run dev` inside `zapping-zero`.
2. Open the page; scroll to “Catalog” section and use Prev/Next buttons to paginate.
3. Change the page size or predicate (e.g., filter by category) in `fetchProductPage` and hot-reload.
