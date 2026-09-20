import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";

describe("clipboard fill series", () => {
  it("fill numeric series downward", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 1 });
    eng.execute({ type: "setCellValue", row: 1, col: 0, value: 2 });
    eng.execute({
      type: "fillCells",
      from: { row: [0, 1], column: [0, 0] },
      to: { row: [0, 3], column: [0, 0] },
    });
    expect(eng.getCellValue(2, 0)).toBe(3);
    expect(eng.getCellValue(3, 0)).toBe(4);
  });

  it("fill numeric series rightward", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 10 });
    eng.execute({ type: "setCellValue", row: 0, col: 1, value: 20 });
    eng.execute({
      type: "fillCells",
      from: { row: [0, 0], column: [0, 1] },
      to: { row: [0, 0], column: [0, 3] },
    });
    expect(eng.getCellValue(0, 2)).toBe(30);
    expect(eng.getCellValue(0, 3)).toBe(40);
  });

  it("fill text suffix series", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "A1" });
    eng.execute({ type: "setCellValue", row: 1, col: 0, value: "A2" });
    eng.execute({
      type: "fillCells",
      from: { row: [0, 1], column: [0, 0] },
      to: { row: [0, 3], column: [0, 0] },
    });
    expect(eng.getCellValue(2, 0)).toBe("A3");
    expect(eng.getCellValue(3, 0)).toBe("A4");
  });

  it("fill date series", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "2024-01-01" });
    eng.execute({
      type: "fillCells",
      from: { row: [0, 0], column: [0, 0] },
      to: { row: [0, 2], column: [0, 0] },
    });
    expect(eng.getCellValue(1, 0)).toBe("2024-01-02");
    expect(eng.getCellValue(2, 0)).toBe("2024-01-03");
  });
});

describe("clipboard copy/cut", () => {
  it("copy paste", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 1 });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.copySelection();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [2, 2], column: [1, 1] }],
    });
    eng.pasteAtSelection();
    expect(eng.getCellValue(2, 1)).toBe(1);
  });

  it("cut clears source", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "x" });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.cutSelection();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [1, 1], column: [0, 0] }],
    });
    eng.pasteAtSelection();
    expect(eng.getCellValue(1, 0)).toBe("x");
    expect(eng.getCellValue(0, 0)).toBeNull();
  });
});
