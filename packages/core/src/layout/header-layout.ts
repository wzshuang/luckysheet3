import type { Workbook } from "../model/workbook.js";
import { buildColOffsets, buildRowOffsets, colLeft, rowTop } from "../hit/location.js";
import { colToLetter } from "../model/cell-key.js";
import { aggregateRowColHeaders } from "../selection/range.js";
import { visibleCellRange } from "./visible-range.js";

export type HeaderLayoutItem = {
  index: number;
  label: string;
  offset: number;
  size: number;
};

export type HeaderSelectionBand = {
  startIndex: number;
  endIndex: number;
};

export type HeaderLayout = {
  rowItems: HeaderLayoutItem[];
  colItems: HeaderLayoutItem[];
  rowSelection: HeaderSelectionBand[];
  colSelection: HeaderSelectionBand[];
  scrollLeft: number;
  scrollTop: number;
};

export function buildHeaderLayout(
  workbook: Workbook,
  viewport: { width: number; height: number },
): HeaderLayout {
  const sheet = workbook.getActiveSheet();
  const rowOffsets = buildRowOffsets(sheet);
  const colOffsets = buildColOffsets(sheet);
  const scrollLeft = workbook.scrollLeft;
  const scrollTop = workbook.scrollTop;

  const range = visibleCellRange(
    sheet,
    viewport,
    scrollLeft,
    scrollTop,
    rowOffsets,
    colOffsets,
  );

  const rowStart = Math.max(0, range.scrollStartRow - 1);
  const rowEnd = Math.min(sheet.rowCount - 1, range.endRow + 1);
  const colStart = Math.max(0, range.scrollStartCol - 1);
  const colEnd = Math.min(sheet.colCount - 1, range.endCol + 1);

  const rowItems: HeaderLayoutItem[] = [];
  for (let r = rowStart; r <= rowEnd; r++) {
    if (sheet.hiddenRows.has(r)) continue;
    const size = sheet.getRowHeight(r);
    if (size <= 0) continue;
    rowItems.push({
      index: r,
      label: String(r + 1),
      offset: rowTop(rowOffsets, r),
      size,
    });
  }

  const colItems: HeaderLayoutItem[] = [];
  for (let c = colStart; c <= colEnd; c++) {
    const size = sheet.getColWidth(c);
    colItems.push({
      index: c,
      label: colToLetter(c),
      offset: colLeft(colOffsets, c),
      size,
    });
  }

  const agg = aggregateRowColHeaders(workbook.selection);
  const rowSelection = agg.rows.map(([a, b]) => ({
    startIndex: a,
    endIndex: b,
  }));
  const colSelection = agg.cols.map(([a, b]) => ({
    startIndex: a,
    endIndex: b,
  }));

  return {
    rowItems,
    colItems,
    rowSelection,
    colSelection,
    scrollLeft,
    scrollTop,
  };
}
