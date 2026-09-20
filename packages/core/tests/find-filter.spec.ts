import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";

describe("find and filter", () => {
  it("findNext jumps selection", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "foo" });
    eng.execute({ type: "setCellValue", row: 2, col: 1, value: "bar foo" });
    // default selection is A1; Find Next starts after it
    const hit = eng.findNext("foo");
    expect(hit).toEqual({ row: 2, col: 1 });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    const hit2 = eng.findNext("foo");
    expect(hit2).toEqual({ row: 2, col: 1 });
  });

  it("replaceAll and undo", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "hello" });
    eng.execute({ type: "setCellValue", row: 1, col: 0, value: "hello world" });
    eng.replaceAll("hello", "hi");
    expect(eng.getCellValue(0, 0, "m")).toBe("hi");
    expect(eng.getCellValue(1, 0, "m")).toBe("hi world");
    eng.undo();
    expect(eng.getCellValue(0, 0, "m")).toBe("hello");
  });

  it("filter hides rows", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "a" });
    eng.execute({ type: "setCellValue", row: 1, col: 0, value: "b" });
    eng.execute({ type: "setCellValue", row: 2, col: 0, value: "a" });
    eng.setColumnFilter(0, ["a"]);
    const sheet = eng.workbook.getActiveSheet();
    expect(sheet.hiddenRows.has(1)).toBe(true);
    expect(sheet.getRowHeight(1)).toBe(0);
    eng.setColumnFilter(0, null);
    expect(sheet.hiddenRows.size).toBe(0);
  });
});
