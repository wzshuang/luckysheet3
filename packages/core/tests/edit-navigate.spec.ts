import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";

describe("edit then click another cell", () => {
  it("commitEditAndSelect keeps A1 value and selects A2", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.startEdit(0, 0);
    eng.setEditDraft("hello");
    expect(eng.editing).toBe(true);

    eng.commitEditAndSelect(1, 0);

    expect(eng.editing).toBe(false);
    expect(eng.getCellValue(0, 0)).toBe("hello");
    expect(eng.selection[0]).toMatchObject({ row: [1, 1], column: [0, 0] });
    expect(eng.getCellValue(1, 0)).toBeNull();
  });

  it("commitEditAndSelect uses live draft without explicit text arg", () => {
    const eng = new WorkbookEngine();
    eng.startEdit(0, 0);
    eng.setEditDraft("typed");
    eng.commitEditAndSelect(0, 1);
    expect(eng.getCellValue(0, 0)).toBe("typed");
    expect(eng.selection[0]).toMatchObject({ row: [0, 0], column: [1, 1] });
  });

  it("commitEdit is idempotent after already committed", () => {
    const eng = new WorkbookEngine();
    eng.startEdit(0, 0);
    eng.commitEdit("once");
    eng.commitEdit("twice");
    expect(eng.getCellValue(0, 0)).toBe("once");
  });

  it("commitEditAndSelect when not editing only moves selection", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "keep" });
    eng.commitEditAndSelect(2, 2);
    expect(eng.getCellValue(0, 0)).toBe("keep");
    expect(eng.selection[0]).toMatchObject({ row: [2, 2], column: [2, 2] });
  });
});
