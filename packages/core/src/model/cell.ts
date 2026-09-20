/**
 * Cell value fields aligned with Luckysheet protocol.
 * Unknown fields from JSON live in `extras`.
 */
export type BorderSide = {
  /** 1 thin, 2 medium */
  style: number;
  color: string;
};

/** Per-cell border (Lucky-compatible `bd`) */
export type CellBorder = {
  t?: BorderSide;
  b?: BorderSide;
  l?: BorderSide;
  r?: BorderSide;
};

export interface CellStyle {
  /** background */
  bg?: string | null;
  /** font color */
  fc?: string | null;
  /** bold 0|1 */
  bl?: number;
  /** italic 0|1 */
  it?: number;
  /** font size */
  fs?: number;
  /** font family index / name */
  ff?: number | string;
  /** horizontal align: 0 center, 1 left, 2 right */
  ht?: number;
  /** vertical align: 0 middle, 1 top, 2 bottom */
  vt?: number;
  /** borders */
  bd?: CellBorder | null;
}

export interface CellType {
  /** format string e.g. General */
  fa?: string;
  /** type: n number, s string, d date, b bool, etc. */
  t?: string;
}

export interface CellData extends CellStyle {
  /** raw value */
  v?: string | number | boolean | null;
  /** display string */
  m?: string | null;
  /** formula string starting with = */
  f?: string | null;
  /** cell type / format */
  ct?: CellType | null;
  /** passthrough unknown fields from Lucky JSON */
  extras?: Record<string, unknown>;
}

export type Cell = CellData | null | undefined;

export function cloneCell(cell: Cell): CellData | null {
  if (cell == null) return null;
  return {
    ...cell,
    ct: cell.ct ? { ...cell.ct } : cell.ct,
    bd: cell.bd
      ? {
          t: cell.bd.t ? { ...cell.bd.t } : undefined,
          b: cell.bd.b ? { ...cell.bd.b } : undefined,
          l: cell.bd.l ? { ...cell.bd.l } : undefined,
          r: cell.bd.r ? { ...cell.bd.r } : undefined,
        }
      : cell.bd,
    extras: cell.extras ? { ...cell.extras } : cell.extras,
  };
}

export function displayValue(cell: Cell): string {
  if (cell == null) return "";
  if (cell.m != null && cell.m !== "") return String(cell.m);
  if (cell.v == null) return "";
  return String(cell.v);
}
