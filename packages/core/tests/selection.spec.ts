import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";
import {
  aggregateRowColHeaders,
  extendRange,
  normalizeRange,
  rangesOverlap,
} from "../src/selection/range.js";
import { selectionToLabel } from "../src/model/cell-key.js";
import {
  buildColOffsets,
  buildRowOffsets,
  hitColHeader,
  hitRowHeader,
  COL_HEADER_HEIGHT,
  ROW_HEADER_WIDTH,
} from "../src/hit/location.js";

describe("selection range helpers", () => {
  it("normalizeRange sorts endpoints and fills focus", () => {
    const n = normalizeRange({ row: [3, 1], column: [2, 0] });
    expect(n.row).toEqual([1, 3]);
    expect(n.column).toEqual([0, 2]);
    expect(n.row_focus).toBe(1);
    expect(n.column_focus).toBe(0);
  });

  it("extendRange expands from focus", () => {
    const anchor = normalizeRange({
      row: [2, 2],
      column: [1, 1],
      row_focus: 2,
      column_focus: 1,
    });
    const ext = extendRange(anchor, 0, 3);
    expect(ext.row).toEqual([0, 2]);
    expect(ext.column).toEqual([1, 3]);
    expect(ext.row_focus).toBe(2);
    expect(ext.column_focus).toBe(1);
  });

  it("rangesOverlap detects intersection", () => {
    expect(
      rangesOverlap(
        { row: [0, 2], column: [0, 1] },
        { row: [2, 4], column: [1, 3] },
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        { row: [0, 1], column: [0, 1] },
        { row: [2, 3], column: [2, 3] },
      ),
    ).toBe(false);
  });

  it("aggregateRowColHeaders merges consecutive indices", () => {
    const agg = aggregateRowColHeaders([
      { row: [0, 1], column: [0, 0] },
      { row: [3, 3], column: [2, 3] },
    ]);
    expect(agg.rows).toEqual([
      [0, 1],
      [3, 3],
    ]);
    expect(agg.cols).toEqual([
      [0, 0],
      [2, 3],
    ]);
  });
});

describe("engine selection API", () => {
  it("selectAt with ctrl appends non-overlapping ranges", () => {
    const eng = new WorkbookEngine();
    eng.selectAt(0, 0);
    eng.selectAt(2, 2, { ctrl: true });
    expect(eng.selection).toHaveLength(2);
    expect(eng.getActiveRange()?.row).toEqual([2, 2]);
    expect(eng.getActiveRange()?.column).toEqual([2, 2]);
  });

  it("selectAt with shift extends from focus", () => {
    const eng = new WorkbookEngine();
    eng.selectAt(1, 1);
    eng.selectAt(3, 2, { shift: true });
    const a = eng.getActiveRange()!;
    expect(a.row).toEqual([1, 3]);
    expect(a.column).toEqual([1, 2]);
    expect(a.row_focus).toBe(1);
    expect(a.column_focus).toBe(1);
  });

  it("selectRow and selectColumn", () => {
    const eng = new WorkbookEngine();
    eng.selectRow(2);
    const rowSel = eng.getActiveRange()!;
    expect(rowSel.row).toEqual([2, 2]);
    expect(rowSel.column[0]).toBe(0);
    expect(rowSel.row_select).toBe(true);
    expect(selectionToLabel(rowSel)).toBe("3:3");

    eng.selectColumn(1);
    const colSel = eng.getActiveRange()!;
    expect(colSel.column).toEqual([1, 1]);
    expect(colSel.row[0]).toBe(0);
    expect(colSel.column_select).toBe(true);
    expect(selectionToLabel(colSel)).toBe("B:B");
  });

  it("selectAll sets focus and select flags", () => {
    const eng = new WorkbookEngine();
    eng.selectAll();
    const a = eng.getActiveRange()!;
    expect(a.row_focus).toBe(0);
    expect(a.column_focus).toBe(0);
    expect(a.row_select).toBe(true);
    expect(a.column_select).toBe(true);
  });

  it("selectionToLabel shows merge focus cell", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "mergeCells",
      row: 0,
      col: 0,
      rowCount: 2,
      colCount: 2,
    });
    eng.selectAt(0, 0);
    const sheet = eng.workbook.getActiveSheet();
    // Select exact merge block
    eng.execute({
      type: "setSelection",
      selection: [
        {
          row: [0, 1],
          column: [0, 1],
          row_focus: 0,
          column_focus: 0,
        },
      ],
    });
    expect(selectionToLabel(eng.getActiveRange()!, sheet)).toBe("A1");
  });
});

describe("header hit-test", () => {
  it("hitRowHeader / hitColHeader", () => {
    const eng = new WorkbookEngine();
    const sheet = eng.workbook.getActiveSheet();
    sheet.rowCount = 10;
    sheet.colCount = 10;
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);

    expect(
      hitRowHeader(sheet, 10, COL_HEADER_HEIGHT + 5, 0, rowOffsets),
    ).toBe(0);
    expect(hitRowHeader(sheet, ROW_HEADER_WIDTH + 5, COL_HEADER_HEIGHT + 5, 0, rowOffsets)).toBeNull();

    expect(
      hitColHeader(sheet, ROW_HEADER_WIDTH + 10, 5, 0, colOffsets),
    ).toBe(0);
    expect(hitColHeader(sheet, 5, COL_HEADER_HEIGHT + 5, 0, colOffsets)).toBeNull();
  });
});
