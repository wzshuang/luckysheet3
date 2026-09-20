import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";

describe("merge and rows", () => {
  it("merges selection and unmerges", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "A" });
    eng.execute({ type: "mergeCells", row: 0, col: 0, rowCount: 2, colCount: 2 });
    expect(eng.workbook.getActiveSheet().getMergeAt(1, 1)).toMatchObject({
      r: 0,
      c: 0,
      rs: 2,
      cs: 2,
    });
    eng.execute({ type: "unmergeCells", row: 1, col: 1 });
    expect(eng.workbook.getActiveSheet().getMergeAt(1, 1)).toBeNull();
  });

  it("insertRows shifts cells down and undo restores", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 2, col: 0, value: 9 });
    eng.execute({ type: "insertRows", index: 1, count: 2 });
    expect(eng.getCellValue(4, 0)).toBe(9);
    expect(eng.getCellValue(2, 0)).toBeNull();
    eng.undo();
    expect(eng.getCellValue(2, 0)).toBe(9);
  });

  it("setRowHeight persists", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setRowHeight", row: 0, height: 40 });
    expect(eng.workbook.getActiveSheet().getRowHeight(0)).toBe(40);
    eng.undo();
    expect(eng.workbook.getActiveSheet().getRowHeight(0)).toBe(19);
  });
});
