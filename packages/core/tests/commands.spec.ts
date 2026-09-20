import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";

describe("CommandBus undo/redo", () => {
  it("undoes setCellValue", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 10 });
    expect(eng.getCellValue(0, 0)).toBe(10);
    eng.undo();
    expect(eng.getCellValue(0, 0)).toBeNull();
    eng.redo();
    expect(eng.getCellValue(0, 0)).toBe(10);
  });

  it("undoes setStyle", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "x" });
    eng.execute({ type: "setStyle", row: 0, col: 0, style: { bl: 1, fc: "#ff0000" } });
    expect(eng.workbook.getCell(0, 0)?.bl).toBe(1);
    eng.undo();
    expect(eng.workbook.getCell(0, 0)?.bl).not.toBe(1);
  });

  it("emits LuckyOp t:v", () => {
    const eng = new WorkbookEngine();
    const ops: unknown[] = [];
    eng.on((e) => {
      if (e.type === "op") ops.push(e.op);
    });
    eng.execute({ type: "setCellValue", row: 1, col: 1, value: 5 });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ t: "v", r: 1, c: 1 });
  });
});
