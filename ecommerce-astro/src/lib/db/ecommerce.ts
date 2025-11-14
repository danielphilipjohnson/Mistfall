import { connect, pred } from '../../../../src/index';
import type { QueryOptions } from '../../../../src/index';
import { ecommerceSchema, products, seedEcommerceData } from '../../examples/ecommerce';
import type { Product } from '../../examples/ecommerce';

export interface ProductPageOptions {
  cursor?: number;
  limit?: number;
  inStockOnly?: boolean;
}

export interface ProductPageResult {
  rows: Product[];
  cursor: number;
  nextCursor: number | null;
  prevCursor: number | null;
}

export async function fetchProductPage(options: ProductPageOptions = {}): Promise<ProductPageResult> {
  const adapter = typeof indexedDB === 'undefined' ? 'memory' : 'auto';
  const client = await connect(ecommerceSchema, { adapter });
  await seedEcommerceData(client);

  const limit = Math.max(1, options.limit ?? 6);
  const cursor = Math.max(0, options.cursor ?? 0);

  const queryOptions: QueryOptions<Product> = {
    orderBy: (row) => row.name.toLowerCase(),
    offset: cursor,
    limit,
  };

  if (options.inStockOnly !== false) {
    queryOptions.where = pred.gt((row) => row.inventory ?? 0, 0);
  }

  const rows = await client.select(products, queryOptions);
  const nextCursor = rows.length === limit ? cursor + limit : null;
  const prevCursor = cursor > 0 ? Math.max(cursor - limit, 0) : null;

  return { rows, cursor, nextCursor, prevCursor };
}
