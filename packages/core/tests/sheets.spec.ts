import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";

describe("sheet management", () => {
  it("add rename delete with undo", () => {
    const eng = new WorkbookEngine();
    expect(eng.sheets).toHaveLength(1);
    eng.addSheet("Data");
    expect(eng.sheets).toHaveLength(2);
    expect(eng.sheets.find((s) => s.name === "Data")).toBeTruthy();
    const idx = eng.activeSheetIndex;
    eng.renameSheet(idx, "Numbers");
    expect(eng.sheets.find((s) => s.index === idx)?.name).toBe("Numbers");
    eng.undo();
    expect(eng.sheets.find((s) => s.index === idx)?.name).toBe("Data");
    eng.deleteSheet(idx);
    expect(eng.sheets).toHaveLength(1);
    eng.undo();
    expect(eng.sheets).toHaveLength(2);
  });

  it("cannot delete last sheet", () => {
    const eng = new WorkbookEngine();
    expect(() => eng.deleteSheet()).toThrow(/last sheet/);
  });
});
