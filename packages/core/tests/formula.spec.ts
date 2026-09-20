import { describe, expect, it } from "vitest";
import { Parser, tokenize } from "../src/formula/parser.js";
import { WorkbookEngine } from "../src/engine.js";

describe("formula parser", () => {
  it("parses arithmetic and refs", () => {
    const ast = Parser.parse("=A1+B2*2");
    expect(ast.type).toBe("binary");
    expect(tokenize("=SUM(A1:A3)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "ident", value: "SUM" }),
        expect.objectContaining({ kind: "ref", value: "A1" }),
        expect.objectContaining({ kind: "colon" }),
      ]),
    );
  });
});

describe("formula functions", () => {
  function engWith(values: Record<string, number | string>) {
    const eng = new WorkbookEngine();
    for (const [a1, v] of Object.entries(values)) {
      const col = a1.charCodeAt(0) - 65;
      const row = Number(a1.slice(1)) - 1;
      eng.execute({ type: "setCellValue", row, col, value: v });
    }
    return eng;
  }

  it("SUM and IF", () => {
    const eng = engWith({ A1: 1, A2: 2, A3: 3 });
    eng.execute({ type: "setCellValue", row: 3, col: 0, value: null, formula: "=SUM(A1:A3)" });
    expect(eng.getCellValue(3, 0)).toBe(6);
    eng.execute({ type: "setCellValue", row: 4, col: 0, value: null, formula: "=IF(A1>0,1,0)" });
    expect(eng.getCellValue(4, 0)).toBe(1);
  });

  it("recalculates dependents", () => {
    const eng = engWith({ A1: 1, A2: 2 });
    eng.execute({ type: "setCellValue", row: 2, col: 0, value: null, formula: "=A1+A2" });
    expect(eng.getCellValue(2, 0)).toBe(3);
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: 10 });
    expect(eng.getCellValue(2, 0)).toBe(12);
  });

  it("AVERAGE COUNT MAX MIN AND OR NOT ROUND ABS", () => {
    const eng = engWith({ A1: 2, A2: 4, A3: 6 });
    eng.execute({ type: "setCellValue", row: 0, col: 1, value: null, formula: "=AVERAGE(A1:A3)" });
    expect(eng.getCellValue(0, 1)).toBe(4);
    eng.execute({ type: "setCellValue", row: 1, col: 1, value: null, formula: "=COUNT(A1:A3)" });
    expect(eng.getCellValue(1, 1)).toBe(3);
    eng.execute({ type: "setCellValue", row: 2, col: 1, value: null, formula: "=MAX(A1:A3)" });
    expect(eng.getCellValue(2, 1)).toBe(6);
    eng.execute({ type: "setCellValue", row: 3, col: 1, value: null, formula: "=MIN(A1:A3)" });
    expect(eng.getCellValue(3, 1)).toBe(2);
    eng.execute({ type: "setCellValue", row: 4, col: 1, value: null, formula: "=AND(A1>0,A2>0)" });
    expect(eng.getCellValue(4, 1)).toBe(true);
    eng.execute({ type: "setCellValue", row: 5, col: 1, value: null, formula: "=OR(A1>10,A2>0)" });
    expect(eng.getCellValue(5, 1)).toBe(true);
    eng.execute({ type: "setCellValue", row: 6, col: 1, value: null, formula: "=NOT(FALSE)" });
    expect(eng.getCellValue(6, 1)).toBe(true);
    eng.execute({ type: "setCellValue", row: 7, col: 1, value: null, formula: "=ROUND(2.56,1)" });
    expect(eng.getCellValue(7, 1)).toBe(2.6);
    eng.execute({ type: "setCellValue", row: 8, col: 1, value: null, formula: "=ABS(-3)" });
    expect(eng.getCellValue(8, 1)).toBe(3);
  });

  it("text functions", () => {
    const eng = engWith({ A1: "  hello  " });
    eng.execute({ type: "setCellValue", row: 0, col: 1, value: null, formula: '=TRIM(A1)' });
    expect(eng.getCellValue(0, 1)).toBe("hello");
    eng.execute({ type: "setCellValue", row: 1, col: 1, value: null, formula: '=LEN("abc")' });
    expect(eng.getCellValue(1, 1)).toBe(3);
    eng.execute({ type: "setCellValue", row: 2, col: 1, value: null, formula: '=CONCAT("a","b")' });
    expect(eng.getCellValue(2, 1)).toBe("ab");
    eng.execute({ type: "setCellValue", row: 3, col: 1, value: null, formula: '=LEFT("xyz",2)' });
    expect(eng.getCellValue(3, 1)).toBe("xy");
    eng.execute({ type: "setCellValue", row: 4, col: 1, value: null, formula: '=RIGHT("xyz",2)' });
    expect(eng.getCellValue(4, 1)).toBe("yz");
  });

  it("VLOOKUP INDEX MATCH", () => {
    const eng = engWith({ A1: "x", B1: 10, A2: "y", B2: 20 });
    eng.execute({
      type: "setCellValue",
      row: 0,
      col: 2,
      value: null,
      formula: '=VLOOKUP("y",A1:B2,2)',
    });
    expect(eng.getCellValue(0, 2)).toBe(20);
    eng.execute({
      type: "setCellValue",
      row: 1,
      col: 2,
      value: null,
      formula: "=INDEX(B1:B2,2)",
    });
    expect(eng.getCellValue(1, 2)).toBe(20);
    eng.execute({
      type: "setCellValue",
      row: 2,
      col: 2,
      value: null,
      formula: '=MATCH("x",A1:A2)',
    });
    expect(eng.getCellValue(2, 2)).toBe(1);
  });

  it("TODAY and NOW return numbers", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: null, formula: "=TODAY()" });
    eng.execute({ type: "setCellValue", row: 1, col: 0, value: null, formula: "=NOW()" });
    expect(typeof eng.getCellValue(0, 0)).toBe("number");
    expect(typeof eng.getCellValue(1, 0)).toBe("number");
  });

  it("COUNTA", () => {
    const eng = engWith({ A1: 1, A2: "a" });
    eng.execute({ type: "setCellValue", row: 2, col: 0, value: null, formula: "=COUNTA(A1:A3)" });
    expect(eng.getCellValue(2, 0)).toBe(2);
  });
});
