import type { Sheet } from "../model/sheet.js";
import { DEFAULT_COL_LEN, DEFAULT_ROW_LEN } from "../model/sheet.js";

export const ROW_HEADER_WIDTH = 46;
export const COL_HEADER_HEIGHT = 20;

/** Cumulative Y positions: result[i] = bottom of row i */
export function buildRowOffsets(sheet: Sheet, maxRows?: number): number[] {
  const n = maxRows ?? sheet.rowCount;
  const offsets: number[] = new Array(n);
  let y = 0;
  for (let r = 0; r < n; r++) {
    y += sheet.getRowHeight(r);
    offsets[r] = y;
  }
  return offsets;
}

export function buildColOffsets(sheet: Sheet, maxCols?: number): number[] {
  const n = maxCols ?? sheet.colCount;
  const offsets: number[] = new Array(n);
  let x = 0;
  for (let c = 0; c < n; c++) {
    x += sheet.getColWidth(c);
    offsets[c] = x;
  }
  return offsets;
}

/** Binary search: first index where offsets[i] > value */
export function searchOffset(offsets: number[], value: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  if (value < 0) return 0;
  if (hi < 0) return 0;
  if (value >= offsets[hi]) return hi;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= value) lo = mid + 1;
    else hi = mid - 1;
  }
  return lo;
}

export function rowTop(offsets: number[], row: number): number {
  if (row <= 0) return 0;
  return offsets[row - 1] ?? 0;
}

export function colLeft(offsets: number[], col: number): number {
  if (col <= 0) return 0;
  return offsets[col - 1] ?? 0;
}

export type CellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
};

export function getCellRect(
  sheet: Sheet,
  row: number,
  col: number,
  rowOffsets: number[],
  colOffsets: number[],
  scrollLeft: number,
  scrollTop: number,
): CellRect {
  const merge = sheet.getMergeAt(row, col);
  const r0 = merge?.r ?? row;
  const c0 = merge?.c ?? col;
  const rs = merge?.rs ?? 1;
  const cs = merge?.cs ?? 1;
  const x =
    ROW_HEADER_WIDTH + colLeft(colOffsets, c0) - scrollLeft;
  const y =
    COL_HEADER_HEIGHT + rowTop(rowOffsets, r0) - scrollTop;
  const right = colOffsets[c0 + cs - 1] ?? colLeft(colOffsets, c0) + DEFAULT_COL_LEN;
  const bottom = rowOffsets[r0 + rs - 1] ?? rowTop(rowOffsets, r0) + DEFAULT_ROW_LEN;
  const left = colLeft(colOffsets, c0);
  const top = rowTop(rowOffsets, r0);
  return {
    x,
    y,
    width: right - left,
    height: bottom - top,
    row: r0,
    col: c0,
  };
}

/** Map viewport pixel (relative to grid content origin including headers) to cell */
export function hitTest(
  sheet: Sheet,
  px: number,
  py: number,
  scrollLeft: number,
  scrollTop: number,
  rowOffsets: number[],
  colOffsets: number[],
): { row: number; col: number } | null {
  if (px < ROW_HEADER_WIDTH || py < COL_HEADER_HEIGHT) return null;
  const contentX = px - ROW_HEADER_WIDTH + scrollLeft;
  const contentY = py - COL_HEADER_HEIGHT + scrollTop;
  const col = searchOffset(colOffsets, contentX);
  const row = searchOffset(rowOffsets, contentY);
  if (row >= sheet.rowCount || col >= sheet.colCount) {
    return {
      row: Math.min(row, sheet.rowCount - 1),
      col: Math.min(col, sheet.colCount - 1),
    };
  }
  const merge = sheet.getMergeAt(row, col);
  if (merge) return { row: merge.r, col: merge.c };
  return { row, col };
}

export function contentSize(
  rowOffsets: number[],
  colOffsets: number[],
): { width: number; height: number } {
  return {
    width: colOffsets[colOffsets.length - 1] ?? 0,
    height: rowOffsets[rowOffsets.length - 1] ?? 0,
  };
}
