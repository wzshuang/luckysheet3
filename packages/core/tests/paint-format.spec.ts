import { describe, expect, it } from "vitest";
import { applyFormat, stripValue } from "../src/clipboard/style.js";
import { WorkbookEngine } from "../src/engine.js";

describe("clipboard style helpers", () => {
  it("stripValue removes v/m/f keeps format", () => {
    const out = stripValue({
      v: 1,
      m: "1",
      f: "=A1",
      bg: "#ff0",
      bl: 1,
      ct: { fa: "0.00", t: "n" },
    });
    expect(out?.v).toBeUndefined();
    expect(out?.m).toBeUndefined();
    expect(out?.f).toBeUndefined();
    expect(out?.bg).toBe("#ff0");
    expect(out?.bl).toBe(1);
    expect(out?.ct?.fa).toBe("0.00");
  });

  it("applyFormat keeps target value, overlays source format keys", () => {
    const next = applyFormat(
      { v: "keep", m: "keep", bg: "#111", fc: "#222" },
      { bg: "#ff0", bl: 1 },
    );
    expect(next?.v).toBe("keep");
    expect(next?.m).toBe("keep");
    expect(next?.bg).toBe("#ff0");
    expect(next?.bl).toBe(1);
    expect(next?.fc).toBe("#222");
  });

  it("applyFormat with null source clears format but keeps value", () => {
    const next = applyFormat({ v: "x", m: "x", bg: "#ff0", bl: 1 }, null);
    expect(next?.v).toBe("x");
    expect(next?.bg).toBeUndefined();
    expect(next?.bl).toBeUndefined();
  });
});

describe("paintFormat command", () => {
  it("tiles format onto target and preserves values", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "src" });
    eng.execute({ type: "setStyle", row: 0, col: 0, style: { bg: "#ff0", bl: 1 } });
    eng.execute({ type: "setCellValue", row: 2, col: 2, value: "dst" });
    eng.execute({
      type: "paintFormat",
      anchorRow: 2,
      anchorCol: 2,
      rowCount: 1,
      colCount: 1,
      source: [[{ bg: "#ff0", bl: 1 }]],
    });
    const cell = eng.workbook.getCell(2, 2);
    expect(cell?.v).toBe("dst");
    expect(cell?.bg).toBe("#ff0");
    expect(cell?.bl).toBe(1);
  });

  it("undo restores previous cells", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "a" });
    eng.execute({
      type: "paintFormat",
      anchorRow: 0,
      anchorCol: 0,
      rowCount: 1,
      colCount: 1,
      source: [[{ bg: "#abc" }]],
    });
    eng.undo();
    expect(eng.workbook.getCell(0, 0)?.bg).toBeUndefined();
    expect(eng.workbook.getCell(0, 0)?.v).toBe("a");
  });
});

describe("paint format engine", () => {
  it("startPaintFormat single applies once then clears", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 1 });
    eng.execute({ type: "setStyle", row: 0, col: 0, style: { bg: "#0f0" } });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    expect(eng.startPaintFormat(true)).toBe(true);
    expect(eng.workbook.paintMode?.single).toBe(true);
    expect(eng.workbook.copyHighlight).not.toBeNull();

    eng.execute({ type: "setCellValue", row: 1, col: 1, value: "t" });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [1, 1], column: [1, 1] }],
    });
    expect(eng.applyPaintFormatToSelection()).toBe(true);
    expect(eng.workbook.getCell(1, 1)?.bg).toBe("#0f0");
    expect(eng.workbook.getCell(1, 1)?.v).toBe("t");
    expect(eng.workbook.paintMode).toBeNull();
  });

  it("rejects paint with multi selection", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [
        { row: [0, 0], column: [0, 0] },
        { row: [1, 1], column: [1, 1] },
      ],
    });
    expect(eng.startPaintFormat(true)).toBe(false);
  });

  it("cancelPaintFormat clears highlight", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.startPaintFormat(false);
    eng.cancelPaintFormat();
    expect(eng.workbook.paintMode).toBeNull();
    expect(eng.workbook.copyHighlight).toBeNull();
  });
});
