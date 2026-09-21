import { describe, expect, it } from "vitest";
import { Sheet } from "../src/model/sheet.js";
import {
  buildRowOffsets,
  buildColOffsets,
  rowIndexAtContentY,
} from "../src/hit/location.js";
import { visibleCellRange } from "../src/layout/visible-range.js";
import { WorkbookEngine } from "../src/engine.js";
import { buildHeaderLayout } from "../src/layout/header-layout.js";

describe("visibleCellRange (freeze 0,0)", () => {
  it("returns first visible rows/cols for scroll 0", () => {
    const sheet = new Sheet({ name: "s", row: 100, column: 50 });
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
    const r = visibleCellRange(
      sheet,
      { width: 400, height: 300 },
      0,
      0,
      rowOffsets,
      colOffsets,
    );
    expect(r.scrollStartRow).toBe(0);
    expect(r.scrollStartCol).toBe(0);
    expect(r.endRow).toBeGreaterThanOrEqual(0);
    expect(r.endCol).toBeGreaterThanOrEqual(0);
  });

  it("advances start col when scrolled horizontally", () => {
    const sheet = new Sheet({ name: "s", row: 10, column: 200 });
    sheet.setColWidth(0, 80);
    for (let c = 1; c < 200; c++) sheet.setColWidth(c, 80);
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
    const r = visibleCellRange(
      sheet,
      { width: 200, height: 100 },
      400,
      0,
      rowOffsets,
      colOffsets,
    );
    expect(r.scrollStartCol).toBeGreaterThanOrEqual(4);
  });
});

describe("buildHeaderLayout", () => {
  it("labels and selection bands", () => {
    const eng = new WorkbookEngine();
    eng.selectRow(0);
    const layout = buildHeaderLayout(eng.workbook, { width: 400, height: 300 });
    expect(layout.colItems.length).toBeGreaterThan(0);
    expect(layout.colItems[0].label).toBe("A");
    expect(layout.rowItems[0].label).toBe("1");
    expect(layout.rowSelection.length).toBeGreaterThan(0);
    expect(layout.rowSelection[0].startIndex).toBe(0);
  });
});

describe("rowIndexAtContentY", () => {
  it("maps content offset to row", () => {
    const sheet = new Sheet({ name: "s", row: 5, column: 3 });
    sheet.setRowHeight(0, 30);
    const rowOffsets = buildRowOffsets(sheet);
    expect(rowIndexAtContentY(sheet, 5, rowOffsets)).toBe(0);
    expect(rowIndexAtContentY(sheet, 35, rowOffsets)).toBe(1);
  });
});
