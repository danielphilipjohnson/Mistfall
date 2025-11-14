import {
  AnyColumn,
  AnyTable,
  InferInsert,
  InferSelect,
  InferUpdate,
  SchemaDef,
} from './ast';

const META_STORE = '__meta';
const SEQ_STORE = '__seq';

type Predicate<T> = (row: T) => boolean;

type OrderBy<T> = keyof T | ((row: T) => IDBValidKey);

export interface QueryOptions<TRow> {
  where?: Predicate<TRow>;
  orderBy?: OrderBy<TRow>;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ConnectOptions {
  dbName?: string;
  adapter?: 'auto' | 'memory';
}

export interface TransactionSession<TSchema extends SchemaDef = SchemaDef> {
  insert<TTable extends AnyTable>(
    table: TTable,
    values: InferInsert<TTable> | InferInsert<TTable>[]
  ): Promise<InferSelect<TTable>[]>;
  select<TTable extends AnyTable>(
    table: TTable,
    options?: QueryOptions<InferSelect<TTable>>
  ): Promise<InferSelect<TTable>[]>;
  update<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>,
    patch: InferUpdate<TTable>
  ): Promise<number>;
  delete<TTable extends AnyTable>(table: TTable, where: Predicate<InferSelect<TTable>>): Promise<number>;
}

export interface DatabaseClient<TSchema extends SchemaDef = SchemaDef> {
  readonly kind: 'indexeddb' | 'memory';
  readonly schema: TSchema;
  insert<TTable extends AnyTable>(
    table: TTable,
    values: InferInsert<TTable> | InferInsert<TTable>[]
  ): Promise<InferSelect<TTable>[]>;
  select<TTable extends AnyTable>(
    table: TTable,
    options?: QueryOptions<InferSelect<TTable>>
  ): Promise<InferSelect<TTable>[]>;
  update<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>,
    patch: InferUpdate<TTable>
  ): Promise<number>;
  delete<TTable extends AnyTable>(table: TTable, where: Predicate<InferSelect<TTable>>): Promise<number>;
  transaction<T>(tables: AnyTable[], fn: (trx: TransactionSession<TSchema>) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function connect<TSchema extends SchemaDef>(
  schema: TSchema,
  options?: ConnectOptions
): Promise<DatabaseClient<TSchema>> {
  const adapterPreference = options?.adapter ?? 'auto';
  const dbName = options?.dbName ?? schema.name;
  const hasIndexedDB = typeof indexedDB !== 'undefined';

  if (adapterPreference === 'memory' || !hasIndexedDB) {
    return new MemoryAdapter(schema);
  }

  return IDBAdapter.create(schema, dbName);
}

type ForeignReference = {
  table: AnyTable;
  column: AnyColumn;
};

type NormalizationContext = {
  allocateIdentity: (table: AnyTable, column: AnyColumn) => Promise<IDBValidKey>;
  ensureForeignKey: (
    sourceTable: AnyTable,
    sourceColumn: AnyColumn,
    targetTable: AnyTable,
    targetColumn: AnyColumn,
    value: IDBValidKey
  ) => Promise<void>;
};

class MemoryAdapter<TSchema extends SchemaDef> implements DatabaseClient<TSchema> {
  readonly kind = 'memory' as const;
  readonly schema: TSchema;
  private readonly stores = new Map<string, Map<IDBValidKey, any>>();
  private readonly sequences = new Map<string, number>();
  private readonly referenceMap: Map<string, ForeignReference[]>;

  constructor(schema: TSchema) {
    this.schema = schema;
    this.referenceMap = buildReferenceMap(schema);
    Object.values(schema.tables).forEach((table) => {
      this.stores.set(storeName(schema, table), new Map());
    });
  }

  async insert<TTable extends AnyTable>(
    table: TTable,
    values: InferInsert<TTable> | InferInsert<TTable>[]
  ): Promise<InferSelect<TTable>[]> {
    return this.insertRows(table, values);
  }

  async select<TTable extends AnyTable>(
    table: TTable,
    options?: QueryOptions<InferSelect<TTable>>
  ): Promise<InferSelect<TTable>[]> {
    return this.selectRows(table, options);
  }

  async update<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>,
    patch: InferUpdate<TTable>
  ): Promise<number> {
    return this.updateRows(table, where, patch);
  }

  async delete<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>
  ): Promise<number> {
    return this.deleteRows(table, where);
  }

  async transaction<T>(tables: AnyTable[], fn: (trx: TransactionSession<TSchema>) => Promise<T>): Promise<T> {
    const storeSnapshots = new Map<string, Map<IDBValidKey, any>>();
    for (const [name, store] of this.stores.entries()) {
      storeSnapshots.set(name, new Map(store));
    }
    const seqSnapshot = new Map(this.sequences);

    const session = this.createTransactionSession();

    try {
      const result = await fn(session);
      return result;
    } catch (error) {
      for (const [name, snapshot] of storeSnapshots.entries()) {
        this.stores.set(name, new Map(snapshot));
      }
      this.sequences.clear();
      for (const [key, value] of seqSnapshot.entries()) {
        this.sequences.set(key, value);
      }
      throw error;
    }
  }

  async close(): Promise<void> {}

  private getStore(table: AnyTable) {
    return this.stores.get(storeName(this.schema, table))!;
  }

  private createTransactionSession(): TransactionSession<TSchema> {
    return {
      insert: (table, values) => this.insertRows(table, values),
      select: (table, options) => this.selectRows(table, options),
      update: (table, where, patch) => this.updateRows(table, where, patch),
      delete: (table, where) => this.deleteRows(table, where),
    };
  }

  private async insertRows<TTable extends AnyTable>(
    table: TTable,
    values: InferInsert<TTable> | InferInsert<TTable>[]
  ): Promise<InferSelect<TTable>[]> {
    const list = Array.isArray(values) ? values : [values];
    const ctx = this.makeContext();
    const results: InferSelect<TTable>[] = [];

    for (const value of list) {
      const normalized = (await normalizeInsertRow(table, value, ctx)) as InferSelect<TTable>;
      applyComputedFields(table, normalized);
      const pk = primaryKeyColumn(table).name;
      const key = normalized[pk] as IDBValidKey;
      const store = this.getStore(table);
      if (store.has(key)) {
        throw new Error(`Primary key violation on ${table.name}.${pk}`);
      }
      store.set(key, cloneRow(normalized));
      results.push(cloneRow(normalized));
    }

    return results;
  }

  private async selectRows<TTable extends AnyTable>(
    table: TTable,
    options?: QueryOptions<InferSelect<TTable>>
  ): Promise<InferSelect<TTable>[]> {
    const rows = Array.from(this.getStore(table).values()).map((row) => cloneRow(row));
    return applyQueryOptions(rows, options);
  }

  private async updateRows<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>,
    patch: InferUpdate<TTable>
  ): Promise<number> {
    const store = this.getStore(table);
    const ctx = this.makeContext();
    let updated = 0;

    for (const [key, row] of store.entries()) {
      if (!where(row)) continue;
      const nextRow = (await normalizeUpdateRow(table, row, patch, ctx)) as InferSelect<TTable>;
      applyComputedFields(table, nextRow);
      store.set(key, cloneRow(nextRow));
      updated++;
    }

    return updated;
  }

  private async deleteRows<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>
  ): Promise<number> {
    const store = this.getStore(table);
    const dependents = this.referenceMap.get(table.name) ?? [];
    let deleted = 0;

    for (const [key, row] of store.entries()) {
      if (!where(row)) continue;
      await assertRestrictDeleteMemory(
        dependents,
        row[primaryKeyColumn(table).name],
        this.schema,
        this.stores
      );
      store.delete(key);
      deleted++;
    }

    return deleted;
  }

  private makeContext(): NormalizationContext {
    return {
      allocateIdentity: async (table) => {
        const name = storeName(this.schema, table);
        const current = this.sequences.get(name) ?? 0;
        const next = current + 1;
        this.sequences.set(name, next);
        return next;
      },
      ensureForeignKey: async (sourceTable, sourceColumn, targetTable, targetColumn, value) => {
        if (value === undefined || value === null) return;
        const store = this.getStore(targetTable);
        if (!store.has(value)) {
          throw new Error(
            `Foreign key violation: ${sourceTable.name}.${sourceColumn.name} ➜ ${targetTable.name}.${targetColumn.name}`
          );
        }
      },
    };
  }
}

class IDBAdapter<TSchema extends SchemaDef> implements DatabaseClient<TSchema> {
  readonly kind = 'indexeddb' as const;
  readonly schema: TSchema;
  private readonly db: IDBDatabase;
  private readonly referenceMap: Map<string, ForeignReference[]>;

  private constructor(schema: TSchema, db: IDBDatabase) {
    this.schema = schema;
    this.db = db;
    this.referenceMap = buildReferenceMap(schema);
  }

  static async create<TSchema extends SchemaDef>(schema: TSchema, dbName: string) {
    const db = await openDatabase(schema, dbName);
    return new IDBAdapter(schema, db);
  }

  async insert<TTable extends AnyTable>(
    table: TTable,
    values: InferInsert<TTable> | InferInsert<TTable>[]
  ): Promise<InferSelect<TTable>[]> {
    const stores = new Set<string>([
      storeName(this.schema, table),
      SEQ_STORE,
      ...referencedStoreNames(this.schema, table),
    ]);

    return this.runTransaction(Array.from(stores), 'readwrite', (tx) =>
      this.insertWithinTransaction(tx, table, values)
    );
  }

  async select<TTable extends AnyTable>(
    table: TTable,
    options?: QueryOptions<InferSelect<TTable>>
  ): Promise<InferSelect<TTable>[]> {
    return this.runTransaction([storeName(this.schema, table)], 'readonly', (tx) =>
      this.selectWithinTransaction(tx, table, options)
    );
  }

  async update<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>,
    patch: InferUpdate<TTable>
  ): Promise<number> {
    const stores = new Set<string>([
      storeName(this.schema, table),
      ...referencedStoreNames(this.schema, table),
    ]);
    return this.runTransaction(Array.from(stores), 'readwrite', (tx) =>
      this.updateWithinTransaction(tx, table, where, patch)
    );
  }

  async delete<TTable extends AnyTable>(
    table: TTable,
    where: Predicate<InferSelect<TTable>>
  ): Promise<number> {
    const dependents = this.referenceMap.get(table.name) ?? [];
    const stores = new Set<string>([storeName(this.schema, table)]);
    dependents.forEach((ref) => stores.add(storeName(this.schema, ref.table)));

    return this.runTransaction(Array.from(stores), 'readwrite', (tx) =>
      this.deleteWithinTransaction(tx, table, where)
    );
  }

  async transaction<T>(tables: AnyTable[], fn: (trx: TransactionSession<TSchema>) => Promise<T>): Promise<T> {
    if (!tables.length) {
      throw new Error('transaction() requires at least one table');
    }
    const storeNames = this.collectTransactionStores(tables);
    const allowed = new Set<string>(tables.map((t) => t.name));

    return this.runTransaction(Array.from(storeNames), 'readwrite', async (tx) => {
      const session = this.createTransactionSession(tx, allowed);
      return fn(session);
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }

  private makeContext(tx: IDBTransaction): NormalizationContext {
    return {
      allocateIdentity: async (table) => {
        const store = tx.objectStore(SEQ_STORE);
        const name = storeName(this.schema, table);
        const current = (await request(store.get(name))) as { value: number } | undefined;
        const next = (current?.value ?? 0) + 1;
        await request(store.put({ table: name, value: next }));
        return next;
      },
      ensureForeignKey: async (sourceTable, sourceColumn, targetTable, targetColumn, value) => {
        if (value === undefined || value === null) return;
        const store = tx.objectStore(storeName(this.schema, targetTable));
        const match = await request(store.get(value));
        if (!match) {
          throw new Error(
            `Foreign key violation: ${sourceTable.name}.${sourceColumn.name} ➜ ${targetTable.name}.${targetColumn.name}`
          );
        }
      },
    };
  }

  private runTransaction<T>(storeNames: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const tx = this.db.transaction(storeNames, mode);
      const work = fn(tx);

      work.catch((error) => {
        reject(error);
        tx.abort();
      });

      const finalize = () => {
        work.then((result) => resolve(result)).catch(reject);
      };

      tx.oncomplete = finalize;
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  private createTransactionSession(tx: IDBTransaction, allowed: Set<string>): TransactionSession<TSchema> {
    const assertAllowed = (table: AnyTable) => {
      if (!allowed.has(table.name)) {
        throw new Error(`Table ${table.name} was not declared for this transaction.`);
      }
    };

    return {
      insert: (table, values) => {
        assertAllowed(table);
        return this.insertWithinTransaction(tx, table, values);
      },
      select: (table, options) => {
        assertAllowed(table);
        return this.selectWithinTransaction(tx, table, options);
      },
      update: (table, where, patch) => {
        assertAllowed(table);
        return this.updateWithinTransaction(tx, table, where, patch);
      },
      delete: (table, where) => {
        assertAllowed(table);
        return this.deleteWithinTransaction(tx, table, where);
      },
    };
  }

  private collectTransactionStores(tables: AnyTable[]): Set<string> {
    const stores = new Set<string>([SEQ_STORE]);
    for (const table of tables) {
      stores.add(storeName(this.schema, table));
      for (const ref of referencedStoreNames(this.schema, table)) {
        stores.add(ref);
      }
      const dependents = this.referenceMap.get(table.name) ?? [];
      dependents.forEach((dep) => stores.add(storeName(this.schema, dep.table)));
    }
    return stores;
  }

  private async insertWithinTransaction<TTable extends AnyTable>(
    tx: IDBTransaction,
    table: TTable,
    values: InferInsert<TTable> | InferInsert<TTable>[]
  ): Promise<InferSelect<TTable>[]> {
    const list = Array.isArray(values) ? values : [values];
    const ctx = this.makeContext(tx);
    const store = tx.objectStore(storeName(this.schema, table));
    const results: InferSelect<TTable>[] = [];
    for (const value of list) {
      const normalized = (await normalizeInsertRow(table, value, ctx)) as InferSelect<TTable>;
      applyComputedFields(table, normalized);
      await request(store.add(normalized));
      results.push(cloneRow(normalized));
    }
    return results;
  }

  private async selectWithinTransaction<TTable extends AnyTable>(
    tx: IDBTransaction,
    table: TTable,
    options?: QueryOptions<InferSelect<TTable>>
  ): Promise<InferSelect<TTable>[]> {
    const rows = await readAll(tx.objectStore(storeName(this.schema, table)));
    return applyQueryOptions(rows, options);
  }

  private async updateWithinTransaction<TTable extends AnyTable>(
    tx: IDBTransaction,
    table: TTable,
    where: Predicate<InferSelect<TTable>>,
    patch: InferUpdate<TTable>
  ): Promise<number> {
    const ctx = this.makeContext(tx);
    const store = tx.objectStore(storeName(this.schema, table));
    const rows = await readAll(store);
    let updated = 0;
    for (const row of rows) {
      if (!where(row)) continue;
      const nextRow = (await normalizeUpdateRow(table, row, patch, ctx)) as InferSelect<TTable>;
      applyComputedFields(table, nextRow);
      await request(store.put(nextRow));
      updated++;
    }
    return updated;
  }

  private async deleteWithinTransaction<TTable extends AnyTable>(
    tx: IDBTransaction,
    table: TTable,
    where: Predicate<InferSelect<TTable>>
  ): Promise<number> {
    const dependents = this.referenceMap.get(table.name) ?? [];
    const store = tx.objectStore(storeName(this.schema, table));
    const rows = await readAll(store);
    let deleted = 0;
    for (const row of rows) {
      if (!where(row)) continue;
      await assertRestrictDeleteIndexedDB(
        dependents,
        row[primaryKeyColumn(table).name],
        tx,
        this.schema
      );
      await request(store.delete(row[primaryKeyColumn(table).name] as IDBValidKey));
      deleted++;
    }
    return deleted;
  }
}

async function normalizeInsertRow(
  table: AnyTable,
  input: Record<string, any>,
  ctx: NormalizationContext
) {
  const row: Record<string, any> = { ...input };
  for (const column of Object.values(table.columns)) {
    let value = row[column.name];
    if (value === undefined) {
      if (column.constraints.identity) {
        value = await ctx.allocateIdentity(table, column);
      } else if (column.defaultFn) {
        value = column.defaultFn();
      } else if (column.defaultValue !== undefined) {
        value = cloneRow(column.defaultValue);
      }
    }
    if ((value === undefined || value === null) && column.constraints.notNull) {
      throw new Error(`Column ${table.name}.${column.name} is not nullable`);
    }
    row[column.name] = value;
  }
  await ensureForeignKeys(table, row, ctx);
  return row;
}

async function normalizeUpdateRow(
  table: AnyTable,
  existing: Record<string, any>,
  patch: Record<string, any>,
  ctx: NormalizationContext
) {
  const row: Record<string, any> = { ...existing, ...patch };
  for (const column of Object.values(table.columns)) {
    const userProvided = Object.prototype.hasOwnProperty.call(patch, column.name);
    let value = row[column.name];
    if (!userProvided && column.onUpdateFn) {
      value = column.onUpdateFn(existing[column.name]);
    }
    if (value === undefined && column.constraints.notNull) {
      throw new Error(`Column ${table.name}.${column.name} is not nullable`);
    }
    row[column.name] = value;
  }
  await ensureForeignKeys(table, row, ctx);
  return row;
}

async function ensureForeignKeys(table: AnyTable, row: Record<string, any>, ctx: NormalizationContext) {
  const schema = table.schema;
  if (!schema) return;
  for (const column of Object.values(table.columns)) {
    if (!column.foreignKey) continue;
    const value = row[column.name];
    if (value === undefined || value === null) continue;
    const targetTable = schema.tables[column.foreignKey.tableName];
    const targetColumn = targetTable?.columns[column.foreignKey.columnName];
    if (targetTable && targetColumn) {
      await ctx.ensureForeignKey(table, column, targetTable, targetColumn, value);
    }
  }
}

function applyComputedFields(table: AnyTable, row: Record<string, any>) {
  table.indexes.forEach((idx) => {
    if (idx.computed) {
      row[idx.computed.field] = idx.computed.expression(row);
    }
  });
}

async function assertRestrictDeleteMemory(
  dependents: ForeignReference[],
  key: IDBValidKey,
  schema: SchemaDef,
  stores: Map<string, Map<IDBValidKey, any>>
) {
  for (const ref of dependents) {
    const store = stores.get(storeName(schema, ref.table));
    if (!store) continue;
    for (const row of store.values()) {
      if (row[ref.column.name] === key) {
        throw new Error(`Delete restricted by ${ref.table.name}.${ref.column.name}`);
      }
    }
  }
}

async function assertRestrictDeleteIndexedDB(
  dependents: ForeignReference[],
  key: IDBValidKey,
  tx: IDBTransaction,
  schema: SchemaDef
) {
  for (const ref of dependents) {
    const store = tx.objectStore(storeName(schema, ref.table));
    const rows = await readAll(store);
    for (const row of rows) {
      if (row[ref.column.name] === key) {
        throw new Error(`Delete restricted by ${ref.table.name}.${ref.column.name}`);
      }
    }
  }
}

function primaryKeyColumn(table: AnyTable): AnyColumn {
  const pk = Object.values(table.columns).find((col) => col.constraints.primaryKey);
  if (!pk) {
    throw new Error(`Table ${table.name} is missing a primary key`);
  }
  return pk;
}

function storeName(schema: SchemaDef, table: AnyTable) {
  return `${schema.namespace}__${table.name}`;
}

function referencedStoreNames(schema: SchemaDef, table: AnyTable) {
  const names = new Set<string>();
  Object.values(table.columns).forEach((column) => {
    if (!column.foreignKey) return;
    const target = schema.tables[column.foreignKey.tableName];
    if (target) names.add(storeName(schema, target));
  });
  return Array.from(names);
}

function buildReferenceMap(schema: SchemaDef) {
  const map = new Map<string, ForeignReference[]>();
  Object.values(schema.tables).forEach((table) => {
    Object.values(table.columns).forEach((column) => {
      if (!column.foreignKey) return;
      const collection = map.get(column.foreignKey.tableName) ?? [];
      collection.push({ table, column });
      map.set(column.foreignKey.tableName, collection);
    });
  });
  return map;
}

function applyQueryOptions<TRow>(rows: TRow[], options?: QueryOptions<TRow>) {
  if (!options) return rows;
  let result = rows;
  if (options.where) {
    result = result.filter(options.where);
  }
  if (options.orderBy) {
    const selector = typeof options.orderBy === 'function'
      ? options.orderBy
      : (row: any) => row[options.orderBy as keyof TRow];
    result = [...result].sort((a, b) => {
      const av = selector(a as any);
      const bv = selector(b as any);
      if (av === bv) return 0;
      return av > bv ? 1 : -1;
    });
    if (options.order === 'desc') {
      result.reverse();
    }
  }
  const offset = options.offset ?? 0;
  const limit = options.limit ?? result.length;
  return result.slice(offset, offset + limit);
}

function cloneRow<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

async function readAll(store: IDBObjectStore): Promise<any[]> {
  return (await request(store.getAll())) as any[];
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

async function openDatabase(schema: SchemaDef, dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, schema.version);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    req.onupgradeneeded = () => upgradeDatabase(schema, req);
    req.onsuccess = () => resolve(req.result);
  });
}

function upgradeDatabase(schema: SchemaDef, request: IDBOpenDBRequest) {
  const db = request.result;
  const tx = request.transaction;
  if (!tx) return;

  if (!db.objectStoreNames.contains(META_STORE)) {
    db.createObjectStore(META_STORE, { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains(SEQ_STORE)) {
    db.createObjectStore(SEQ_STORE, { keyPath: 'table' });
  }

  Object.values(schema.tables).forEach((table) => {
    const name = storeName(schema, table);
    let store: IDBObjectStore;
    if (!db.objectStoreNames.contains(name)) {
      store = db.createObjectStore(name, { keyPath: primaryKeyColumn(table).name });
    } else {
      store = tx.objectStore(name);
    }
    table.indexes.forEach((idx) => {
      if (!store.indexNames.contains(idx.name)) {
        const keyPath = idx.computed ? idx.computed.field : idx.sourceColumns[0];
        store.createIndex(idx.name, keyPath, { unique: idx.unique });
      }
    });
  });

  const meta = tx.objectStore(META_STORE);
  meta.put({ key: 'schema', version: schema.version, signature: schema.signature, upgradedAt: Date.now() });
}
