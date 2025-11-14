export type ColumnKind =
  | 'int'
  | 'bigint'
  | 'float'
  | 'decimal'
  | 'varchar'
  | 'text'
  | 'boolean'
  | 'timestamp'
  | 'json'
  | 'enum';

export type DeleteRule = 'restrict' | 'cascade';

export interface ColumnConstraintRuntime {
  notNull: boolean;
  primaryKey: boolean;
  unique: boolean;
  identity: boolean;
  hasDefault: boolean;
}

export interface ReferenceConfig {
  resolver: () => AnyColumn;
  onDelete: DeleteRule;
}

export interface ForeignKeyMeta {
  tableName: string;
  columnName: string;
  onDelete: DeleteRule;
}

export interface ColumnDef<
  TData = any,
  TConstraints extends ColumnConstraintRuntime = ColumnConstraintRuntime
> {
  readonly kind: ColumnKind;
  readonly name: string;
  readonly options?: Record<string, unknown>;
  readonly constraints: TConstraints;
  readonly defaultValue?: TData;
  readonly defaultFn?: () => TData;
  readonly onUpdateFn?: (prev: TData) => TData;
  readonly reference?: ReferenceConfig;
  foreignKey?: ForeignKeyMeta;
  table?: () => AnyTable;
  tableName?: string;
  readonly $type?: TData;
}

export type ColumnRecord = Record<string, ColumnDef<any, ColumnConstraintRuntime>>;
export type AnyColumn = ColumnDef<any, ColumnConstraintRuntime>;

export interface IndexComputedConfig {
  readonly field: string;
  readonly expression: (row: any) => IDBValidKey;
}

export interface IndexDef {
  readonly name: string;
  readonly unique: boolean;
  readonly sourceColumns: string[];
  readonly computed?: IndexComputedConfig;
}

export interface TableDef<TColumns extends ColumnRecord = ColumnRecord> {
  readonly kind: 'table';
  readonly name: string;
  readonly columns: TColumns;
  readonly indexes: IndexDef[];
  schema?: SchemaDef;
}

export type TableWithColumns<TColumns extends ColumnRecord> = TableDef<TColumns> & {
  [K in keyof TColumns]: TColumns[K];
};

export type AnyTable = TableWithColumns<Record<string, AnyColumn>>;

export interface SchemaOptions {
  name: string;
  version?: number;
  namespace?: string;
}

export interface SchemaDef<TTables extends Record<string, AnyTable> = Record<string, AnyTable>> {
  readonly kind: 'schema';
  readonly name: string;
  readonly version: number;
  readonly namespace: string;
  readonly tables: TTables;
  readonly signature: string;
}

export type ColumnsOf<TTable extends AnyTable> = TTable['columns'];

export type ColumnType<C extends AnyColumn> = C extends ColumnDef<infer T, any> ? T : never;

export type ColumnOptionalOnInsert<C extends AnyColumn> = C['constraints']['notNull'] extends true
  ? C['constraints']['hasDefault'] extends true
    ? true
    : false
  : true;

export type ColumnOptionalOnUpdate<C extends AnyColumn> = true;

type OptionalKeysByInsert<TColumns extends ColumnRecord> = {
  [K in keyof TColumns]: ColumnOptionalOnInsert<TColumns[K]> extends true ? K : never;
}[keyof TColumns];

type RequiredKeysByInsert<TColumns extends ColumnRecord> = Exclude<keyof TColumns, OptionalKeysByInsert<TColumns>>;

type ColumnValueMap<TColumns extends ColumnRecord> = {
  [K in keyof TColumns]: ColumnType<TColumns[K]>;
};

export type InferSelect<TTable extends AnyTable> = Simplify<ColumnValueMap<ColumnsOf<TTable>>>;

export type InferInsert<TTable extends AnyTable> = Simplify<
  Pick<ColumnValueMap<ColumnsOf<TTable>>, RequiredKeysByInsert<ColumnsOf<TTable>>> &
    Partial<Pick<ColumnValueMap<ColumnsOf<TTable>>, OptionalKeysByInsert<ColumnsOf<TTable>>>>
>;

export type InferUpdate<TTable extends AnyTable> = Partial<InferSelect<TTable>>;

export type TableRecord = Record<string, AnyTable>;

export type SchemaTableNames<TSchema extends SchemaDef> = keyof TSchema['tables'];

export type Simplify<T> = { [K in keyof T]: T[K] } & {};
