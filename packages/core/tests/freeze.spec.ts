import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";
import { getCellRect, buildRowOffsets, buildColOffsets } from "../src/hit/location.js";

describe("freeze", () => {
  it("setFreeze stores config and undo restores", () => {
    const eng = new WorkbookEngine();
    eng.setFreeze(1, 0);
    expect(eng.workbook.getActiveSheet().config.freeze).toEqual({ row: 1, col: 0 });
    eng.undo();
    expect(eng.workbook.getActiveSheet().config.freeze).toEqual({ row: 0, col: 0 });
  });

  it("frozen row ignores scrollTop in getCellRect", () => {
    const eng = new WorkbookEngine();
    eng.setFreeze(1, 0);
    eng.workbook.setScroll(0, 50);
    const sheet = eng.workbook.getActiveSheet();
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
    const rect0 = getCellRect(sheet, 0, 0, rowOffsets, colOffsets, 0, 50);
    const unfrozenYWithoutScroll = getCellRect(sheet, 0, 0, rowOffsets, colOffsets, 0, 0).y;
    expect(rect0.y).toBe(unfrozenYWithoutScroll);
    const rect2Scrolled = getCellRect(sheet, 2, 0, rowOffsets, colOffsets, 0, 50);
    const rect2NoScroll = getCellRect(sheet, 2, 0, rowOffsets, colOffsets, 0, 0);
    expect(rect2Scrolled.y).toBe(rect2NoScroll.y - 50);
  });

  it("frozen col ignores scrollLeft in getCellRect", () => {
    const eng = new WorkbookEngine();
    eng.setFreeze(0, 1);
    eng.workbook.setScroll(80, 0);
    const sheet = eng.workbook.getActiveSheet();
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
    const rect0 = getCellRect(sheet, 0, 0, rowOffsets, colOffsets, 80, 0);
    const withoutScroll = getCellRect(sheet, 0, 0, rowOffsets, colOffsets, 0, 0).x;
    expect(rect0.x).toBe(withoutScroll);
    const rect2Scrolled = getCellRect(sheet, 0, 2, rowOffsets, colOffsets, 80, 0);
    const rect2NoScroll = getCellRect(sheet, 0, 2, rowOffsets, colOffsets, 0, 0);
    expect(rect2Scrolled.x).toBe(rect2NoScroll.x - 80);
  });
});
