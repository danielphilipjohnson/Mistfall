export const eq = <T>(selector: (row: any) => T, value: T) => (row: any) => selector(row) === value;
export const neq = <T>(selector: (row: any) => T, value: T) => (row: any) => selector(row) !== value;
export const gt = <T extends number | string | bigint>(selector: (row: any) => T, value: T) =>
  (row: any) => selector(row) > value;
export const lt = <T extends number | string | bigint>(selector: (row: any) => T, value: T) =>
  (row: any) => selector(row) < value;
export const and = (...predicates: Array<(row: any) => boolean>) => (row: any) => predicates.every((p) => p(row));
export const or = (...predicates: Array<(row: any) => boolean>) => (row: any) => predicates.some((p) => p(row));
