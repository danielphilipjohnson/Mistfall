import {
  AnyColumn,
  AnyTable,
  ColumnConstraintRuntime,
  ColumnDef,
  ColumnKind,
  ColumnRecord,
  IndexComputedConfig,
  IndexDef,
  ReferenceConfig,
  SchemaDef,
  SchemaOptions,
  TableDef,
  TableRecord,
  TableWithColumns,
} from './ast';

const DEFAULT_CONSTRAINTS = Object.freeze({
  notNull: false as const,
  primaryKey: false as const,
  unique: false as const,
  identity: false as const,
  hasDefault: false as const,
});

type ConstraintDefaults = typeof DEFAULT_CONSTRAINTS;
type ConstraintState = ColumnConstraintRuntime;

type WithFlag<T extends ConstraintState, K extends keyof ConstraintState> = Omit<T, K> & {
  [P in K]: true;
};

type ColumnBuilderRuntime<TData, TState extends ConstraintState> = {
  kind: ColumnKind;
  options?: Record<string, unknown>;
  constraints: TState;
  defaultValue?: TData;
  defaultFn?: () => TData;
  onUpdateFn?: (prev: TData) => TData;
  reference?: ReferenceConfig;
};

export class ColumnBuilder<TData, TState extends ConstraintState = ConstraintState> {
  private readonly runtime: ColumnBuilderRuntime<TData, TState>;
  readonly _data!: TData;
  readonly _state!: TState;

  constructor(runtime: ColumnBuilderRuntime<TData, TState>) {
    this.runtime = runtime;
  }

  private fork<TNextState extends ConstraintState>(
    mutate: (runtime: ColumnBuilderRuntime<TData, TState>) => ColumnBuilderRuntime<TData, TNextState>
  ): ColumnBuilder<TData, TNextState> {
    return new ColumnBuilder<TData, TNextState>(mutate({
      kind: this.runtime.kind,
      options: this.runtime.options ? { ...this.runtime.options } : undefined,
      constraints: { ...this.runtime.constraints } as TState,
      defaultValue: this.runtime.defaultValue,
      defaultFn: this.runtime.defaultFn,
      onUpdateFn: this.runtime.onUpdateFn,
      reference: this.runtime.reference,
    }));
  }

  options(options: Record<string, unknown>): ColumnBuilder<TData, TState> {
    return this.fork((state) => ({ ...state, options }));
  }

  notNull(): ColumnBuilder<TData, WithFlag<TState, 'notNull'>> {
    return this.fork((state) => ({
      ...state,
      constraints: { ...state.constraints, notNull: true } as WithFlag<TState, 'notNull'>,
    }));
  }

  primaryKey(): ColumnBuilder<TData, WithFlag<WithFlag<TState, 'primaryKey'>, 'notNull'>> {
    return this.fork((state) => ({
      ...state,
      constraints: {
        ...state.constraints,
        primaryKey: true,
        notNull: true,
      } as WithFlag<WithFlag<TState, 'primaryKey'>, 'notNull'>,
    }));
  }

  unique(): ColumnBuilder<TData, WithFlag<TState, 'unique'>> {
    return this.fork((state) => ({
      ...state,
      constraints: { ...state.constraints, unique: true } as WithFlag<TState, 'unique'>,
    }));
  }

  identity(): ColumnBuilder<TData, WithFlag<WithFlag<TState, 'identity'>, 'hasDefault'>> {
    return this.fork((state) => ({
      ...state,
      constraints: {
        ...state.constraints,
        identity: true,
        hasDefault: true,
      } as WithFlag<WithFlag<TState, 'identity'>, 'hasDefault'>,
    }));
  }

  generatedAlwaysAsIdentity(): ColumnBuilder<TData, WithFlag<WithFlag<TState, 'identity'>, 'hasDefault'>> {
    return this.identity();
  }

  default(value: TData): ColumnBuilder<TData, WithFlag<TState, 'hasDefault'>> {
    return this.fork((state) => ({
      ...state,
      defaultValue: value,
      constraints: { ...state.constraints, hasDefault: true } as WithFlag<TState, 'hasDefault'>,
    }));
  }

  $defaultFn(fn: () => TData): ColumnBuilder<TData, WithFlag<TState, 'hasDefault'>> {
    return this.fork((state) => ({
      ...state,
      defaultFn: fn,
      constraints: { ...state.constraints, hasDefault: true } as WithFlag<TState, 'hasDefault'>,
    }));
  }

  $onUpdate(fn: (prev: TData) => TData): ColumnBuilder<TData, TState> {
    return this.fork((state) => ({
      ...state,
      onUpdateFn: fn,
    }));
  }

  references(resolver: () => AnyColumn, opts?: { onDelete?: 'restrict' | 'cascade' }): ColumnBuilder<TData, TState> {
    return this.fork((state) => ({
      ...state,
      reference: {
        resolver,
        onDelete: opts?.onDelete ?? 'restrict',
      },
    }));
  }

  build(columnName: string): ColumnDef<TData, TState> {
    return {
      kind: this.runtime.kind,
      name: columnName,
      options: this.runtime.options,
      constraints: this.runtime.constraints,
      defaultValue: this.runtime.defaultValue,
      defaultFn: this.runtime.defaultFn,
      onUpdateFn: this.runtime.onUpdateFn,
      reference: this.runtime.reference,
    } as ColumnDef<TData, TState>;
  }
}

const scalar = <TData>(kind: ColumnKind, options?: Record<string, unknown>) =>
  new ColumnBuilder<TData, ConstraintDefaults>({
    kind,
    options: options ? { ...options } : undefined,
    constraints: { ...DEFAULT_CONSTRAINTS },
  });

export class IndexBuilder {
  private readonly name: string;
  private readonly uniqueFlag: boolean;
  private columns: string[] = [];
  private computed?: IndexComputedConfig;

  constructor(name: string, opts?: { unique?: boolean }) {
    this.name = name;
    this.uniqueFlag = opts?.unique ?? false;
  }

  on(...columns: AnyColumn[]): IndexDef {
    if (!columns.length) {
      throw new Error('index.on() requires at least one column');
    }
    this.columns = columns.map((col) => col.name);
    return this.build();
  }

  onColumn(column: AnyColumn): IndexDef {
    return this.on(column);
  }

  onComputed(expression: (row: any) => IDBValidKey, field?: string): IndexDef {
    const computedField = field ?? `__idx_${this.name}`;
    this.computed = { expression, field: computedField };
    this.columns = [];
    return this.build();
  }

  private build(): IndexDef {
    return {
      name: this.name,
      unique: this.uniqueFlag,
      sourceColumns: this.columns,
      computed: this.computed,
    };
  }
}

export const index = (name: string) => new IndexBuilder(name);
export const uniqueIndex = (name: string) => new IndexBuilder(name, { unique: true });

export const t = {
  int: (opts?: { unsigned?: boolean }) => scalar<number>('int', opts),
  integer(opts?: { unsigned?: boolean }) {
    return this.int(opts);
  },
  bigint: (opts?: { mode?: 'bigint' | 'number'; unsigned?: boolean }) =>
    scalar<bigint | number>('bigint', { mode: opts?.mode ?? 'bigint', unsigned: opts?.unsigned ?? false }),
  float: () => scalar<number>('float'),
  decimal: (opts?: { precision?: number; scale?: number; mode?: 'string' | 'number' | 'bigint' }) =>
    scalar<string>('decimal', opts),
  varchar: (opts: { length: number; enum?: readonly string[] }) => scalar<string>('varchar', opts),
  text: (opts?: { enum?: readonly string[] }) => scalar<string>('text', opts),
  boolean: () => scalar<boolean>('boolean'),
  timestamp: (opts?: { mode?: 'date' | 'number' | 'string'; fsp?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) =>
    scalar<number>('timestamp', { mode: opts?.mode ?? 'number', fsp: opts?.fsp ?? 3 }),
  json: <T>() => scalar<T>('json'),
  enum: <T extends readonly string[]>(values: T) => scalar<T[number]>('enum', { values }),
  index,
  uniqueIndex,
};

type ColumnBuildersRecord = Record<string, ColumnBuilder<any, any>>;

type BuiltColumns<TColumns extends ColumnBuildersRecord> = {
  [K in keyof TColumns]: TColumns[K] extends ColumnBuilder<infer TData, infer TState>
    ? ColumnDef<TData, TState>
    : never;
} & ColumnRecord;

export function table<const TColumns extends ColumnBuildersRecord>(
  name: string,
  columns: TColumns,
  indexesFactory?: (columns: BuiltColumns<TColumns>) => IndexDef[]
): TableWithColumns<BuiltColumns<TColumns>> {
  const builtColumns = Object.fromEntries(
    Object.entries(columns).map(([columnName, builder]) => {
      const built = builder.build(columnName);
      return [columnName, built];
    })
  ) as BuiltColumns<TColumns>;

  const tableDef = {
    kind: 'table',
    name,
    columns: builtColumns,
    indexes: indexesFactory ? indexesFactory(builtColumns) : [],
  } satisfies TableDef<BuiltColumns<TColumns>>;

  if (!Object.values(builtColumns).some((col) => col.constraints.primaryKey)) {
    throw new Error(`Table ${name} must declare a primary key column.`);
  }

  const shape = tableDef as TableWithColumns<BuiltColumns<TColumns>>;

  Object.values(builtColumns).forEach((column) => {
    column.table = () => shape;
    column.tableName = name;
  });

  Object.entries(builtColumns).forEach(([key, column]) => {
    (shape as Record<string, ColumnDef<any>>)[key] = column;
  });

  return shape;
}

export function schema<const TTables extends TableRecord>(
  optionsOrName: SchemaOptions | string,
  tables: TTables
): SchemaDef<TTables> {
  const options: SchemaOptions = typeof optionsOrName === 'string' ? { name: optionsOrName } : optionsOrName;
  const namespace = options.namespace ?? options.name;
  const version = options.version ?? 1;
  const signature = JSON.stringify(
    Object.values(tables).map((table) => ({
      name: table.name,
      columns: Object.values(table.columns).map((col) => ({
        name: col.name,
        kind: col.kind,
        constraints: col.constraints,
      })),
      indexes: table.indexes.map((idx) => ({ name: idx.name, unique: idx.unique, cols: idx.sourceColumns })),
    }))
  );

  resolveForeignKeys(tables);

  const schemaDef: SchemaDef<TTables> = {
    kind: 'schema',
    name: options.name,
    version,
    namespace,
    tables,
    signature,
  } satisfies SchemaDef<TTables>;

  Object.values(tables).forEach((table) => {
    (table as TableDef).schema = schemaDef;
  });

  return schemaDef;
}

function resolveForeignKeys(tables: TableRecord) {
  const tableMap = new Map<string, AnyTable>();
  Object.values(tables).forEach((table) => tableMap.set(table.name, table));

  Object.values(tables).forEach((table) => {
    Object.values(table.columns).forEach((column) => {
      const ref = column.reference;
      if (!ref || column.foreignKey) return;
      const target = ref.resolver();
      if (!target?.tableName) {
        throw new Error(`Unable to resolve foreign key on ${table.name}.${column.name}`);
      }
      column.foreignKey = {
        tableName: target.tableName,
        columnName: target.name,
        onDelete: ref.onDelete,
      };
    });
  });
}
