import { useEffect, useState } from 'react';
import { fetchProductPage } from '../lib/db/ecommerce';
import type { Product } from '../examples/ecommerce';

const PAGE_SIZE = 4;

export default function ProductPager() {
  const [items, setItems] = useState<Product[]>([]);
  const [cursor, setCursor] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [prevCursor, setPrevCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProductPage({ cursor, limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setItems(page.rows);
        setNextCursor(page.nextCursor);
        setPrevCursor(page.prevCursor);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cursor]);

  return (
    <section>
      <h2>Catalog (cursor {cursor})</h2>
      {loading && <p>Loading products…</p>}
      <ul>
        {items.map((product) => (
          <li key={product.id}>
            <strong>{product.name}</strong> — {product.price} ({product.inventory} in stock)
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => prevCursor !== null && setCursor(prevCursor)} disabled={prevCursor === null || loading}>
          Prev
        </button>
        <button onClick={() => nextCursor !== null && setCursor(nextCursor)} disabled={nextCursor === null || loading}>
          Next
        </button>
      </div>
    </section>
  );
}
