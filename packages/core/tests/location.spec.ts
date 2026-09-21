import { describe, expect, it } from "vitest";
import { Sheet } from "../src/model/sheet.js";
import {
  buildColOffsets,
  buildRowOffsets,
  hitTest,
  hitCorner,
  rowTop,
  searchOffset,
  colLeft,
  ROW_HEADER_WIDTH,
  COL_HEADER_HEIGHT,
} from "../src/hit/location.js";
import { WorkbookEngine } from "../src/engine.js";
import { selectionToLabel } from "../src/model/cell-key.js";

describe("location / hit-test", () => {
  it("builds cumulative offsets from rowlen", () => {
    const sheet = new Sheet({
      name: "S",
      index: 0,
      row: 5,
      column: 5,
      config: { rowlen: { "0": 20, "1": 40 }, columnlen: { "0": 50, "1": 100 } },
    });
    const rows = buildRowOffsets(sheet, 5);
    expect(rows[0]).toBe(20);
    expect(rows[1]).toBe(60);
    expect(rowTop(rows, 1)).toBe(20);
    expect(searchOffset(rows, 25)).toBe(1);

    const cols = buildColOffsets(sheet, 5);
    expect(colLeft(cols, 1)).toBe(50);
    expect(searchOffset(cols, 50)).toBe(1);
  });

  it("hitTests into cell accounting for headers and scroll", () => {
    const sheet = new Sheet({ name: "S", index: 0, row: 10, column: 10 });
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
    const hit = hitTest(
      sheet,
      ROW_HEADER_WIDTH + 10,
      COL_HEADER_HEIGHT + 5,
      0,
      0,
      rowOffsets,
      colOffsets,
    );
    expect(hit).toEqual({ row: 0, col: 0 });
  });

  it("hitCorner detects top-left header intersection", () => {
    expect(hitCorner(0, 0)).toBe(true);
    expect(hitCorner(ROW_HEADER_WIDTH - 1, COL_HEADER_HEIGHT - 1)).toBe(true);
    expect(hitCorner(ROW_HEADER_WIDTH, 0)).toBe(false);
    expect(hitCorner(0, COL_HEADER_HEIGHT)).toBe(false);
  });
});

describe("select all", () => {
  it("selectAll covers entire sheet and labels as A1:…", () => {
    const eng = new WorkbookEngine();
    const sheet = eng.workbook.getActiveSheet();
    sheet.rowCount = 3;
    sheet.colCount = 2;
    eng.selectAll();
    expect(eng.selection[0]).toMatchObject({
      row: [0, 2],
      column: [0, 1],
      row_focus: 0,
      column_focus: 0,
      row_select: true,
      column_select: true,
    });
    expect(selectionToLabel(eng.selection[0]!)).toBe("A1:B3");
  });
});
