import type { Sheet } from "../model/sheet.js";
import { DEFAULT_COL_LEN, DEFAULT_ROW_LEN } from "../model/sheet.js";

export const ROW_HEADER_WIDTH = 46;
export const COL_HEADER_HEIGHT = 20;

/** Cumulative Y positions: result[i] = bottom of row i (hidden rows contribute 0) */
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

function freezeOf(sheet: Sheet): { row: number; col: number } {
  return sheet.config.freeze ?? { row: 0, col: 0 };
}

/** Effective scroll for a cell given freeze panes */
export function effectiveScroll(
  sheet: Sheet,
  row: number,
  col: number,
  scrollLeft: number,
  scrollTop: number,
): { left: number; top: number } {
  const fr = freezeOf(sheet);
  return {
    left: col < fr.col ? 0 : scrollLeft,
    top: row < fr.row ? 0 : scrollTop,
  };
}

export function freezeBandSize(
  sheet: Sheet,
  rowOffsets: number[],
  colOffsets: number[],
): { height: number; width: number } {
  const fr = freezeOf(sheet);
  return {
    height: fr.row > 0 ? rowTop(rowOffsets, fr.row) : 0,
    width: fr.col > 0 ? colLeft(colOffsets, fr.col) : 0,
  };
}

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
  const fr = freezeOf(sheet);
  const effLeft = c0 < fr.col ? 0 : scrollLeft;
  const effTop = r0 < fr.row ? 0 : scrollTop;
  const x = ROW_HEADER_WIDTH + colLeft(colOffsets, c0) - effLeft;
  const y = COL_HEADER_HEIGHT + rowTop(rowOffsets, r0) - effTop;
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
  const band = freezeBandSize(sheet, rowOffsets, colOffsets);
  const localX = px - ROW_HEADER_WIDTH;
  const localY = py - COL_HEADER_HEIGHT;

  const contentX = localX < band.width ? localX : localX + scrollLeft;
  const contentY = localY < band.height ? localY : localY + scrollTop;

  const col = searchOffset(colOffsets, contentX);
  const row = searchOffset(rowOffsets, contentY);
  if (row >= sheet.rowCount || col >= sheet.colCount) {
    return {
      row: Math.min(row, Math.max(0, sheet.rowCount - 1)),
      col: Math.min(col, Math.max(0, sheet.colCount - 1)),
    };
  }
  if (sheet.hiddenRows.has(row)) return null;
  const merge = sheet.getMergeAt(row, col);
  if (merge) return { row: merge.r, col: merge.c };
  return { row, col };
}

/** Top-left corner where row header meets column header */
export function hitCorner(px: number, py: number): boolean {
  return px >= 0 && py >= 0 && px < ROW_HEADER_WIDTH && py < COL_HEADER_HEIGHT;
}

/** Hit-test row header body (not resize edge) → row index */
export function hitRowHeader(
  sheet: Sheet,
  px: number,
  py: number,
  scrollTop: number,
  rowOffsets: number[],
): number | null {
  if (px < 0 || px >= ROW_HEADER_WIDTH || py < COL_HEADER_HEIGHT) return null;
  const fr = freezeOf(sheet);
  const bandH = fr.row > 0 ? rowTop(rowOffsets, fr.row) : 0;
  const localY = py - COL_HEADER_HEIGHT;
  const contentY = localY < bandH ? localY : localY + scrollTop;
  const row = searchOffset(rowOffsets, contentY);
  if (row < 0) return null;
  return Math.min(row, Math.max(0, sheet.rowCount - 1));
}

/** Hit-test column header body (not resize edge) → col index */
export function hitColHeader(
  sheet: Sheet,
  px: number,
  py: number,
  scrollLeft: number,
  colOffsets: number[],
): number | null {
  if (py < 0 || py >= COL_HEADER_HEIGHT || px < ROW_HEADER_WIDTH) return null;
  const fr = freezeOf(sheet);
  const bandW = fr.col > 0 ? colLeft(colOffsets, fr.col) : 0;
  const localX = px - ROW_HEADER_WIDTH;
  const contentX = localX < bandW ? localX : localX + scrollLeft;
  const col = searchOffset(colOffsets, contentX);
  if (col < 0) return null;
  return Math.min(col, Math.max(0, sheet.colCount - 1));
}

/** Hit-test row header edge for resize (returns row index whose bottom edge is near) */
export function hitRowResize(
  sheet: Sheet,
  px: number,
  py: number,
  scrollTop: number,
  rowOffsets: number[],
  threshold = 3,
): number | null {
  if (px > ROW_HEADER_WIDTH || py < COL_HEADER_HEIGHT) return null;
  const fr = freezeOf(sheet);
  for (let r = 0; r < sheet.rowCount; r++) {
    if (sheet.hiddenRows.has(r)) continue;
    const yEdge =
      COL_HEADER_HEIGHT +
      (rowOffsets[r] ?? 0) -
      (r + 1 <= fr.row ? 0 : scrollTop);
    if (Math.abs(py - yEdge) <= threshold) return r;
  }
  return null;
}

/** Row index at content Y (freeze 0,0); null if hidden */
export function rowIndexAtContentY(
  sheet: Sheet,
  contentY: number,
  rowOffsets: number[],
): number | null {
  if (contentY < 0) return null;
  const row = searchOffset(rowOffsets, contentY);
  if (row < 0 || row >= sheet.rowCount) return null;
  if (sheet.hiddenRows.has(row)) return null;
  return row;
}

export function colIndexAtContentX(
  sheet: Sheet,
  contentX: number,
  colOffsets: number[],
): number | null {
  if (contentX < 0) return null;
  const col = searchOffset(colOffsets, contentX);
  if (col < 0 || col >= sheet.colCount) return null;
  return col;
}

export function rowResizeIndexAtContentY(
  sheet: Sheet,
  contentY: number,
  rowOffsets: number[],
  threshold = 3,
): number | null {
  for (let r = 0; r < sheet.rowCount; r++) {
    if (sheet.hiddenRows.has(r)) continue;
    const edge = rowOffsets[r] ?? 0;
    if (Math.abs(contentY - edge) <= threshold) return r;
  }
  return null;
}

export function colResizeIndexAtContentX(
  sheet: Sheet,
  contentX: number,
  colOffsets: number[],
  threshold = 3,
): number | null {
  for (let c = 0; c < sheet.colCount; c++) {
    const edge = colOffsets[c] ?? 0;
    if (Math.abs(contentX - edge) <= threshold) return c;
  }
  return null;
}

export function hitColResize(
  sheet: Sheet,
  px: number,
  py: number,
  scrollLeft: number,
  colOffsets: number[],
  threshold = 3,
): number | null {
  if (py > COL_HEADER_HEIGHT || px < ROW_HEADER_WIDTH) return null;
  const fr = freezeOf(sheet);
  for (let c = 0; c < sheet.colCount; c++) {
    const xEdge =
      ROW_HEADER_WIDTH +
      (colOffsets[c] ?? 0) -
      (c + 1 <= fr.col ? 0 : scrollLeft);
    if (Math.abs(px - xEdge) <= threshold) return c;
  }
  return null;
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

/** Fill-handle rect (bottom-right of selection), or null */
export function getFillHandleRect(
  sheet: Sheet,
  selection: { row: [number, number]; column: [number, number] },
  rowOffsets: number[],
  colOffsets: number[],
  scrollLeft: number,
  scrollTop: number,
): { x: number; y: number; size: number } {
  const r1 = Math.max(selection.row[0], selection.row[1]);
  const c1 = Math.max(selection.column[0], selection.column[1]);
  const rect = getCellRect(
    sheet,
    r1,
    c1,
    rowOffsets,
    colOffsets,
    scrollLeft,
    scrollTop,
  );
  const size = 6;
  return {
    x: rect.x + rect.width - size / 2,
    y: rect.y + rect.height - size / 2,
    size,
  };
}
