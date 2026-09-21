import { describe, expect, it } from "vitest";
import { Sheet } from "../src/model/sheet.js";
import { buildRowOffsets, buildColOffsets } from "../src/hit/location.js";
import { visibleCellRange } from "../src/layout/visible-range.js";

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
