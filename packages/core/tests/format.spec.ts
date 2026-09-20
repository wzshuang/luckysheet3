import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";
import { formatDisplay } from "../src/format/number-format.js";

describe("number format", () => {
  it("formats number percent currency", () => {
    expect(formatDisplay(1234.5, { fa: "0.00", t: "n" })).toBe("1234.50");
    expect(formatDisplay(0.15, { fa: "0%", t: "n" })).toBe("15%");
    expect(formatDisplay(1234.5, { fa: "¥#,##0.00", t: "n" })).toBe("¥1,234.50");
  });

  it("applyFormat updates m and undoes", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 12.3 });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.applyFormatToSelection("number");
    expect(eng.workbook.getCell(0, 0)?.m).toBe("12.30");
    expect(eng.workbook.getCell(0, 0)?.ct?.fa).toBe("0.00");
    eng.undo();
    expect(eng.workbook.getCell(0, 0)?.ct?.fa).toBe("General");
  });

  it("percent stores fraction when value > 1", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 50 });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.applyFormatToSelection("percent");
    expect(eng.workbook.getCell(0, 0)?.v).toBe(0.5);
    expect(eng.workbook.getCell(0, 0)?.m).toBe("50%");
  });

  it("clearFormat strips styles", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 1 });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.applyStyleToSelection({ bl: 1, bg: "#ff0", fs: 16 });
    eng.clearFormatOnSelection();
    const cell = eng.workbook.getCell(0, 0);
    expect(cell?.bl).toBeUndefined();
    expect(cell?.bg).toBeUndefined();
    expect(cell?.fs).toBeUndefined();
    expect(cell?.v).toBe(1);
  });

  it("toggle bold", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.toggleStyleOnSelection("bl");
    expect(eng.workbook.getCell(0, 0)?.bl).toBe(1);
    eng.toggleStyleOnSelection("bl");
    expect(eng.workbook.getCell(0, 0)?.bl).toBe(0);
  });
});
