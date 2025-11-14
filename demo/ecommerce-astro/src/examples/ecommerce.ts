import { schema, table, t, index } from '../../../../src/builders';
import type { DatabaseClient } from '../../../../src/runtime';
import type { InferSelect } from '../../../../src/ast';
 
const fields = {
  id: t.int().primaryKey().identity(),
  slug: t.varchar({ length: 64 }).notNull().unique(),
  name: t.varchar({ length: 128 }).notNull(),
  description: t.text(),
  createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()),
  updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
}

export const categories = table(
  'categories',
  fields,
  (cols) => [t.uniqueIndex('categories_slug_idx').on(cols.slug)]
);

export const products = table(
  'products',
  {
    id: t.int().primaryKey().identity(),
    sku: t.varchar({ length: 64 }).notNull().unique(),
    name: t.varchar({ length: 256 }).notNull(),
    description: t.text(),
    price: t.decimal({ precision: 10, scale: 2 }).notNull(),
    currency: t.varchar({ length: 3 }).default('USD'),
    inventory: t.int().default(0),
    categoryId: t.int().references(() => categories.id).notNull(),
    createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()),
    updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (cols) => [
    t.uniqueIndex('products_sku_idx').on(cols.sku),
    index('products_category_idx').on(cols.categoryId),
  ]
);

export const customers = table(
  'customers',
  {
    id: t.int().primaryKey().identity(),
    email: t.varchar({ length: 256 }).notNull().unique(),
    firstName: t.varchar({ length: 128 }).notNull(),
    lastName: t.varchar({ length: 128 }).notNull(),
    loyaltyTier: t.enum(['bronze', 'silver', 'gold'] as const).default('bronze'),
    createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()),
  },
  (cols) => [t.uniqueIndex('customers_email_idx').on(cols.email)]
);

export const orders = table(
  'orders',
  {
    id: t.int().primaryKey().identity(),
    orderNumber: t.varchar({ length: 24 }).notNull().unique(),
    customerId: t.int().references(() => customers.id).notNull(),
    status: t.enum(['pending', 'paid', 'shipped', 'cancelled'] as const).default('pending'),
    subtotal: t.decimal({ precision: 12, scale: 2 }).default('0.00'),
    tax: t.decimal({ precision: 12, scale: 2 }).default('0.00'),
    total: t.decimal({ precision: 12, scale: 2 }).default('0.00'),
    currency: t.varchar({ length: 3 }).default('USD'),
    createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()),
    updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (cols) => [t.uniqueIndex('orders_number_idx').on(cols.orderNumber), index('orders_customer_idx').on(cols.customerId)]
);

export const orderItems = table(
  'order_items',
  {
    id: t.int().primaryKey().identity(),
    orderId: t.int().references(() => orders.id).notNull(),
    productId: t.int().references(() => products.id).notNull(),
    quantity: t.int().default(1),
    unitPrice: t.decimal({ precision: 10, scale: 2 }).notNull(),
    total: t.decimal({ precision: 12, scale: 2 }).default('0.00'),
  },
  (cols) => [
    index('order_items_order_idx').on(cols.orderId),
    index('order_items_product_idx').on(cols.productId),
  ]
);

export const ecommerceSchema = schema({ name: 'ecommerce-app', version: 1 }, {
  categories,
  products,
  customers,
  orders,
  orderItems,
});

export type Category = InferSelect<typeof categories>;
export type Product = InferSelect<typeof products>;
export type Customer = InferSelect<typeof customers>;
export type Order = InferSelect<typeof orders>;
export type OrderItem = InferSelect<typeof orderItems>;

export interface CheckoutItem {
  productId: number;
  quantity: number;
}

export async function seedEcommerceData(client: DatabaseClient<typeof ecommerceSchema>) {
  const existing = await client.select(categories);
  if (existing.length) return;

  const [apparel, gadgets] = await client.insert(categories, [
    { name: 'Apparel', slug: 'apparel', description: 'Everything wearable' },
    { name: 'Gadgets', slug: 'gadgets', description: 'Latest tech gear' },
  ]);

  const [tshirt, hoodie, earbuds] = await client.insert(products, [
    {
      sku: 'TSHIRT-001',
      name: 'Classic Tee',
      description: 'Soft cotton unisex tee',
      price: '24.00',
      inventory: 120,
      categoryId: apparel.id,
    },
    {
      sku: 'HOODIE-001',
      name: 'Logo Hoodie',
      description: 'Pullover hoodie with front pocket',
      price: '55.00',
      inventory: 80,
      categoryId: apparel.id,
    },
    {
      sku: 'BUDS-100',
      name: 'Wireless Earbuds',
      description: 'Noise-cancelling Bluetooth earbuds',
      price: '99.00',
      inventory: 45,
      categoryId: gadgets.id,
    },
  ]);

  const [sara, mike] = await client.insert(customers, [
    { email: 'sara@example.com', firstName: 'Sara', lastName: 'Lee', loyaltyTier: 'gold' },
    { email: 'mike@example.com', firstName: 'Mike', lastName: 'Nguyen', loyaltyTier: 'silver' },
  ]);

  const [order1, order2] = await client.insert(orders, [
    {
      orderNumber: 'WEB-1001',
      customerId: sara.id,
      status: 'paid',
      subtotal: '79.00',
      tax: '6.32',
      total: '85.32',
    },
    {
      orderNumber: 'WEB-1002',
      customerId: mike.id,
      status: 'pending',
      subtotal: '99.00',
      tax: '7.92',
      total: '106.92',
    },
  ]);

  await client.insert(orderItems, [
    {
      orderId: order1.id,
      productId: tshirt.id,
      quantity: 1,
      unitPrice: tshirt.price,
      total: '24.00',
    },
    {
      orderId: order1.id,
      productId: hoodie.id,
      quantity: 1,
      unitPrice: hoodie.price,
      total: '55.00',
    },
    {
      orderId: order2.id,
      productId: earbuds.id,
      quantity: 1,
      unitPrice: earbuds.price,
      total: '99.00',
    },
  ]);
}

export async function checkoutCart(
  client: DatabaseClient<typeof ecommerceSchema>,
  customerId: number,
  cart: CheckoutItem[]
) {
  if (!cart.length) {
    throw new Error('Cart is empty');
  }

  return client.transaction([orders, orderItems, products], async (trx) => {
    let subtotal = 0;
    const orderLines: Array<{ productId: number; quantity: number; unitPrice: string; total: string }> = [];

    for (const item of cart) {
      const [product] = await trx.select(products, {
        where: (row) => row.id === item.productId,
        limit: 1,
      });
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      const available = product.inventory ?? 0;
      if (available < item.quantity) {
        throw new Error(`Insufficient inventory for ${product.name}`);
      }

      const updatedInventory = available - item.quantity;
      await trx.update(
        products,
        (row) => row.id === product.id,
        { inventory: updatedInventory }
      );

      const unitPriceNumber = Number(product.price);
      const lineTotal = unitPriceNumber * item.quantity;
      subtotal += lineTotal;

      orderLines.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
        total: lineTotal.toFixed(2),
      });
    }

    const taxValue = (subtotal * 0.08).toFixed(2);
    const totalValue = (subtotal + Number(taxValue)).toFixed(2);

    const [order] = await trx.insert(orders, {
      orderNumber: `WEB-${Date.now()}`,
      customerId,
      status: 'paid',
      subtotal: subtotal.toFixed(2),
      tax: taxValue,
      total: totalValue,
    });

    await trx.insert(
      orderItems,
      orderLines.map((line) => ({ ...line, orderId: order.id }))
    );

    return order;
  });
}
