import type { Sheet } from "../model/sheet.js";
import { searchOffset } from "../hit/location.js";

export type VisibleRange = {
  scrollStartRow: number;
  endRow: number;
  scrollStartCol: number;
  endCol: number;
};

/** viewport = cell surface CSS size; freeze treated as 0,0 for range */
export function visibleCellRange(
  sheet: Sheet,
  viewport: { width: number; height: number },
  scrollLeft: number,
  scrollTop: number,
  rowOffsets: number[],
  colOffsets: number[],
): VisibleRange {
  const w = viewport.width;
  const h = viewport.height;
  const scrollStartCol = Math.max(0, searchOffset(colOffsets, scrollLeft));
  const endCol = Math.min(
    sheet.colCount - 1,
    searchOffset(colOffsets, scrollLeft + w) + 1,
  );
  const scrollStartRow = Math.max(0, searchOffset(rowOffsets, scrollTop));
  const endRow = Math.min(
    sheet.rowCount - 1,
    searchOffset(rowOffsets, scrollTop + h) + 1,
  );
  return { scrollStartRow, endRow, scrollStartCol, endCol };
}
