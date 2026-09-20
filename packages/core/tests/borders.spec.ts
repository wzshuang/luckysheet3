import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";

describe("borders", () => {
  it("applies all borders to selection and undoes", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 1], column: [0, 1] }],
    });
    eng.applyBordersToSelection("all", "#ff0000", 1);
    const cell = eng.workbook.getCell(0, 0);
    expect(cell?.bd?.t?.color).toBe("#ff0000");
    expect(cell?.bd?.l?.color).toBe("#ff0000");
    expect(eng.workbook.getActiveSheet().config.borderInfo).toHaveLength(1);
    eng.undo();
    expect(eng.workbook.getCell(0, 0)?.bd).toBeUndefined();
  });

  it("outside only paints perimeter", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 2], column: [0, 2] }],
    });
    eng.applyBordersToSelection("outside");
    expect(eng.workbook.getCell(1, 1)?.bd?.t).toBeUndefined();
    expect(eng.workbook.getCell(0, 1)?.bd?.t).toBeTruthy();
    expect(eng.workbook.getCell(1, 0)?.bd?.l).toBeTruthy();
  });
});
