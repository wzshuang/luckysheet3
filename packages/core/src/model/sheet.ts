import { cellKey, parseCellKey } from "./cell-key.js";
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
  /** freeze before this row/col count (0 = none) */
  freeze?: { row: number; col: number };
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

/** Serializable patch for structural undo */
export type SheetStatePatch = {
  celldata: Array<{ r: number; c: number; v: CellData }>;
  config: SheetConfig;
  rowCount: number;
  colCount: number;
  hiddenRows: number[];
};

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
  /** rows hidden by filter */
  hiddenRows = new Set<number>();
  private cells = new Map<string, CellData>();

  constructor(init?: Partial<SheetSnapshot>) {
    this.name = init?.name ?? "Sheet1";
    this.index = init?.index ?? 0;
    this.order = init?.order ?? 0;
    this.status = init?.status ?? 1;
    this.config = { ...(init?.config ?? {}) };
    if (this.config.merge) this.config.merge = { ...this.config.merge };
    if (this.config.rowlen) this.config.rowlen = { ...this.config.rowlen };
    if (this.config.columnlen) this.config.columnlen = { ...this.config.columnlen };
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

  forEachCell(fn: (row: number, col: number, cell: CellData) => void): void {
    for (const [key, cell] of this.cells) {
      const { row, col } = parseCellKey(key);
      fn(row, col, cell);
    }
  }

  captureState(): SheetStatePatch {
    const celldata: SheetStatePatch["celldata"] = [];
    this.forEachCell((r, c, v) => celldata.push({ r, c, v: cloneCell(v)! }));
    return {
      celldata,
      config: JSON.parse(JSON.stringify(this.config)) as SheetConfig,
      rowCount: this.rowCount,
      colCount: this.colCount,
      hiddenRows: [...this.hiddenRows],
    };
  }

  restoreState(patch: SheetStatePatch): void {
    this.cells.clear();
    for (const item of patch.celldata) {
      this.cells.set(cellKey(item.r, item.c), cloneCell(item.v)!);
    }
    this.config = JSON.parse(JSON.stringify(patch.config)) as SheetConfig;
    this.rowCount = patch.rowCount;
    this.colCount = patch.colCount;
    this.hiddenRows = new Set(patch.hiddenRows);
  }

  getRowHeight(row: number): number {
    if (this.hiddenRows.has(row)) return 0;
    const v = this.config.rowlen?.[String(row)];
    return typeof v === "number" ? v : DEFAULT_ROW_LEN;
  }

  getColWidth(col: number): number {
    const v = this.config.columnlen?.[String(col)];
    return typeof v === "number" ? v : DEFAULT_COL_LEN;
  }

  setRowHeight(row: number, height: number): void {
    if (!this.config.rowlen) this.config.rowlen = {};
    this.config.rowlen[String(row)] = Math.max(4, height);
  }

  setColWidth(col: number, width: number): void {
    if (!this.config.columnlen) this.config.columnlen = {};
    this.config.columnlen[String(col)] = Math.max(4, width);
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

  isMergeCovered(row: number, col: number): boolean {
    const m = this.getMergeAt(row, col);
    return m != null && (m.r !== row || m.c !== col);
  }

  setMerge(range: MergeRange): void {
    if (range.rs < 1 || range.cs < 1) return;
    if (!this.config.merge) this.config.merge = {};
    for (const [key, m] of Object.entries(this.config.merge)) {
      const overlap =
        range.r < m.r + m.rs &&
        range.r + range.rs > m.r &&
        range.c < m.c + m.cs &&
        range.c + range.cs > m.c;
      if (overlap) delete this.config.merge[key];
    }
    this.config.merge[`${range.r}_${range.c}`] = { ...range };
  }

  removeMergeAt(row: number, col: number): MergeRange | null {
    const m = this.getMergeAt(row, col);
    if (!m || !this.config.merge) return null;
    for (const [key, v] of Object.entries(this.config.merge)) {
      if (v.r === m.r && v.c === m.c) delete this.config.merge[key];
    }
    return m;
  }

  insertRows(index: number, count: number): void {
    if (count <= 0) return;
    const next = new Map<string, CellData>();
    this.forEachCell((r, c, cell) => {
      next.set(cellKey(r >= index ? r + count : r, c), cell);
    });
    this.cells = next;
    this.rowCount += count;
    this.shiftMergeRows(index, count);
    this.shiftRowlen(index, count);
    this.shiftHiddenRows(index, count);
  }

  deleteRows(index: number, count: number): void {
    if (count <= 0) return;
    const end = index + count;
    const next = new Map<string, CellData>();
    this.forEachCell((r, c, cell) => {
      if (r >= index && r < end) return;
      next.set(cellKey(r >= end ? r - count : r, c), cell);
    });
    this.cells = next;
    this.rowCount = Math.max(1, this.rowCount - count);
    this.shiftMergeRows(index, -count);
    this.shiftRowlen(index, -count);
    this.shiftHiddenRows(index, -count);
  }

  insertCols(index: number, count: number): void {
    if (count <= 0) return;
    const next = new Map<string, CellData>();
    this.forEachCell((r, c, cell) => {
      next.set(cellKey(r, c >= index ? c + count : c), cell);
    });
    this.cells = next;
    this.colCount += count;
    this.shiftMergeCols(index, count);
    this.shiftColumnlen(index, count);
  }

  deleteCols(index: number, count: number): void {
    if (count <= 0) return;
    const end = index + count;
    const next = new Map<string, CellData>();
    this.forEachCell((r, c, cell) => {
      if (c >= index && c < end) return;
      next.set(cellKey(r, c >= end ? c - count : c), cell);
    });
    this.cells = next;
    this.colCount = Math.max(1, this.colCount - count);
    this.shiftMergeCols(index, -count);
    this.shiftColumnlen(index, -count);
  }

  private shiftMergeRows(index: number, delta: number): void {
    const merge = this.config.merge;
    if (!merge) return;
    const next: Record<string, MergeRange> = {};
    for (const m of Object.values(merge)) {
      let { r, c, rs, cs } = m;
      if (delta > 0) {
        if (r >= index) r += delta;
        else if (r + rs > index) rs += delta;
      } else {
        const rem = -delta;
        const end = index + rem;
        if (r >= end) r -= rem;
        else if (r + rs <= index) {
          /* unchanged */
        } else if (r >= index && r + rs <= end) {
          continue;
        } else {
          const top = Math.min(Math.max(r, index), end);
          const bottom = Math.min(Math.max(r + rs, index), end);
          rs -= bottom - top;
          if (r >= index) r = index;
          if (rs < 1) continue;
        }
      }
      next[`${r}_${c}`] = { r, c, rs, cs };
    }
    this.config.merge = next;
  }

  private shiftMergeCols(index: number, delta: number): void {
    const merge = this.config.merge;
    if (!merge) return;
    const next: Record<string, MergeRange> = {};
    for (const m of Object.values(merge)) {
      let { r, c, rs, cs } = m;
      if (delta > 0) {
        if (c >= index) c += delta;
        else if (c + cs > index) cs += delta;
      } else {
        const rem = -delta;
        const end = index + rem;
        if (c >= end) c -= rem;
        else if (c + cs <= index) {
          /* unchanged */
        } else if (c >= index && c + cs <= end) {
          continue;
        } else {
          const left = Math.min(Math.max(c, index), end);
          const right = Math.min(Math.max(c + cs, index), end);
          cs -= right - left;
          if (c >= index) c = index;
          if (cs < 1) continue;
        }
      }
      next[`${r}_${c}`] = { r, c, rs, cs };
    }
    this.config.merge = next;
  }

  private shiftRowlen(index: number, delta: number): void {
    const src = this.config.rowlen;
    if (!src) return;
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      const r = Number(k);
      if (delta > 0) next[String(r >= index ? r + delta : r)] = v;
      else {
        const rem = -delta;
        if (r >= index && r < index + rem) continue;
        next[String(r >= index + rem ? r - rem : r)] = v;
      }
    }
    this.config.rowlen = next;
  }

  private shiftColumnlen(index: number, delta: number): void {
    const src = this.config.columnlen;
    if (!src) return;
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      const c = Number(k);
      if (delta > 0) next[String(c >= index ? c + delta : c)] = v;
      else {
        const rem = -delta;
        if (c >= index && c < index + rem) continue;
        next[String(c >= index + rem ? c - rem : c)] = v;
      }
    }
    this.config.columnlen = next;
  }

  private shiftHiddenRows(index: number, delta: number): void {
    const next = new Set<number>();
    for (const r of this.hiddenRows) {
      if (delta > 0) next.add(r >= index ? r + delta : r);
      else {
        const rem = -delta;
        if (r >= index && r < index + rem) continue;
        next.add(r >= index + rem ? r - rem : r);
      }
    }
    this.hiddenRows = next;
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
      config: JSON.parse(JSON.stringify(this.config)) as SheetConfig,
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
