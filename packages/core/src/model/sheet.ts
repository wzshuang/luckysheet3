import { cellKey } from "./cell-key.js";
import { type Cell, type CellData, cloneCell } from "./cell.js";

export interface MergeRange {
  r: number;
  c: number;
  rs: number;
  cs: number;
}

export interface SheetConfig {
  merge?: Record<string, MergeRange>;
  rowlen?: Record<string, number>;
  columnlen?: Record<string, number>;
  [key: string]: unknown;
}

export interface SheetSnapshot {
  name: string;
  index: string | number;
  order: number;
  status: number;
  celldata: Array<{ r: number; c: number; v: CellData }>;
  config: SheetConfig;
  row?: number;
  column?: number;
  extras?: Record<string, unknown>;
}

const DEFAULT_ROW_LEN = 19;
const DEFAULT_COL_LEN = 73;
const DEFAULT_ROWS = 84;
const DEFAULT_COLS = 60;

export class Sheet {
  name: string;
  index: string | number;
  order: number;
  status: number;
  config: SheetConfig;
  rowCount: number;
  colCount: number;
  extras: Record<string, unknown>;
  private cells = new Map<string, CellData>();

  constructor(init?: Partial<SheetSnapshot>) {
    this.name = init?.name ?? "Sheet1";
    this.index = init?.index ?? 0;
    this.order = init?.order ?? 0;
    this.status = init?.status ?? 1;
    this.config = { ...(init?.config ?? {}) };
    this.rowCount = init?.row ?? DEFAULT_ROWS;
    this.colCount = init?.column ?? DEFAULT_COLS;
    this.extras = { ...(init?.extras ?? {}) };
    if (init?.celldata) {
      for (const item of init.celldata) {
        if (item?.v != null) {
          this.cells.set(cellKey(item.r, item.c), cloneCell(item.v)!);
          this.rowCount = Math.max(this.rowCount, item.r + 1);
          this.colCount = Math.max(this.colCount, item.c + 1);
        }
      }
    }
  }

  getCell(row: number, col: number): CellData | null {
    return this.cells.get(cellKey(row, col)) ?? null;
  }

  setCell(row: number, col: number, cell: Cell): void {
    const key = cellKey(row, col);
    if (cell == null) {
      this.cells.delete(key);
      return;
    }
    const cloned = cloneCell(cell)!;
    this.cells.set(key, cloned);
    this.rowCount = Math.max(this.rowCount, row + 1);
    this.colCount = Math.max(this.colCount, col + 1);
  }

  /** Sparse iteration */
  forEachCell(fn: (row: number, col: number, cell: CellData) => void): void {
    for (const [key, cell] of this.cells) {
      const i = key.indexOf("_");
      fn(Number(key.slice(0, i)), Number(key.slice(i + 1)), cell);
    }
  }

  getRowHeight(row: number): number {
    const v = this.config.rowlen?.[String(row)];
    return typeof v === "number" ? v : DEFAULT_ROW_LEN;
  }

  getColWidth(col: number): number {
    const v = this.config.columnlen?.[String(col)];
    return typeof v === "number" ? v : DEFAULT_COL_LEN;
  }

  getMergeAt(row: number, col: number): MergeRange | null {
    const merge = this.config.merge;
    if (!merge) return null;
    for (const m of Object.values(merge)) {
      if (
        row >= m.r &&
        row < m.r + m.rs &&
        col >= m.c &&
        col < m.c + m.cs
      ) {
        return m;
      }
    }
    return null;
  }

  /** True if (row,col) is covered by a merge but is not the top-left */
  isMergeCovered(row: number, col: number): boolean {
    const m = this.getMergeAt(row, col);
    return m != null && (m.r !== row || m.c !== col);
  }

  toSnapshot(): SheetSnapshot {
    const celldata: SheetSnapshot["celldata"] = [];
    this.forEachCell((r, c, v) => {
      celldata.push({ r, c, v: cloneCell(v)! });
    });
    return {
      name: this.name,
      index: this.index,
      order: this.order,
      status: this.status,
      celldata,
      config: { ...this.config, merge: this.config.merge ? { ...this.config.merge } : undefined },
      row: this.rowCount,
      column: this.colCount,
      extras: { ...this.extras },
    };
  }

  get cellCount(): number {
    return this.cells.size;
  }
}

export { DEFAULT_ROW_LEN, DEFAULT_COL_LEN, DEFAULT_ROWS, DEFAULT_COLS };
