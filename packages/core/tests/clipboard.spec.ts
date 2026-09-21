import { describe, expect, it } from "vitest";
import { WorkbookEngine } from "../src/engine.js";
import {
  cellsToHtml,
  cellsToTsv,
  parseClipboardPayload,
  parseHtmlTable,
  parseTsv,
} from "../src/clipboard/serialize.js";
import { extractMerges } from "../src/clipboard/clipboard.js";

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
    expect(eng.workbook.copyHighlight).toEqual(
      expect.objectContaining({ row: [0, 0], column: [0, 0] }),
    );
    eng.execute({
      type: "setSelection",
      selection: [{ row: [2, 2], column: [1, 1] }],
    });
    eng.pasteAtSelection();
    expect(eng.getCellValue(2, 1)).toBe(1);
    // copy paste keeps marching ants
    expect(eng.workbook.copyHighlight).not.toBeNull();
  });

  it("cut clears source and highlight", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "x" });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.cutSelection();
    expect(eng.workbook.copyHighlight).not.toBeNull();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [1, 1], column: [0, 0] }],
    });
    eng.pasteAtSelection();
    expect(eng.getCellValue(1, 0)).toBe("x");
    expect(eng.getCellValue(0, 0)).toBeNull();
    expect(eng.workbook.copyHighlight).toBeNull();
    expect(eng.workbook.clipboard).toBeNull();
  });

  it("Esc clears copy highlight", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 1], column: [0, 1] }],
    });
    eng.copySelection();
    eng.clearCopyHighlight();
    expect(eng.workbook.copyHighlight).toBeNull();
  });
});

describe("TSV / HTML clipboard", () => {
  it("round-trips TSV", () => {
    const cells = [
      [
        { v: 1, m: "1", ct: { fa: "General", t: "n" as const } },
        { v: "a", m: "a", ct: { fa: "General", t: "g" as const } },
      ],
      [null, { v: "b\tc", m: "b\tc", ct: { fa: "General", t: "g" as const } }],
    ];
    const tsv = cellsToTsv(cells);
    expect(tsv).toContain("1\ta");
    const parsed = parseTsv(tsv);
    expect(parsed[0][0]?.v).toBe(1);
    expect(parsed[0][1]?.v).toBe("a");
    expect(parsed[1][1]?.v).toBe("b\tc");
  });

  it("parses Excel-like HTML table", () => {
    const html =
      "<html><body><table><tr><td>1</td><td>hello</td></tr><tr><td></td><td>2</td></tr></table></body></html>";
    const { cells } = parseHtmlTable(html);
    expect(cells).toHaveLength(2);
    expect(cells[0][0]?.v).toBe(1);
    expect(cells[0][1]?.v).toBe("hello");
    expect(cells[1][0]).toBeNull();
    expect(cells[1][1]?.v).toBe(2);
  });

  it("parseHtmlTable reads styles and rowspan", () => {
    const html = `<table><tr>
    <td rowspan="2" style="background-color:#ff0000;font-weight:bold;color:#00ff00">A</td>
    <td style="text-align:center">B</td>
  </tr><tr><td>C</td></tr></table>`;
    const { cells, merges } = parseHtmlTable(html);
    expect(cells[0][0]?.v).toBe("A");
    expect(cells[0][0]?.bg).toBe("#ff0000");
    expect(cells[0][0]?.bl).toBe(1);
    expect(cells[0][0]?.fc).toBe("#00ff00");
    expect(cells[0][1]?.ht).toBe(0);
    expect(cells[1][0]).toBeNull();
    expect(cells[1][1]?.v).toBe("C");
    expect(merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 1 }]);
  });

  it("cellsToHtml writes rowspan and basic style", () => {
    const html = cellsToHtml(
      [
        [{ v: "A", m: "A", bg: "#ff0", bl: 1 }, { v: "B", m: "B" }],
        [null, { v: "C", m: "C" }],
      ],
      [{ r: 0, c: 0, rs: 2, cs: 1 }],
    );
    expect(html).toContain('rowspan="2"');
    expect(html).toContain("background-color:#ff0");
    expect(html).not.toMatch(/<tr><td><\/td><td>C/);
  });

  it("cellsToHtml wraps table", () => {
    const html = cellsToHtml([
      [{ v: "x", m: "x", ct: { fa: "General", t: "g" } }],
    ]);
    expect(html).toBe("<table><tr><td>x</td></tr></table>");
  });

  it("pasteFromExternal TSV into grid", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [1, 1], column: [1, 1] }],
    });
    const ok = eng.pasteFromExternal({ text: "A\tB\nC\tD" });
    expect(ok).toBe(true);
    expect(eng.getCellValue(1, 1)).toBe("A");
    expect(eng.getCellValue(1, 2)).toBe("B");
    expect(eng.getCellValue(2, 1)).toBe("C");
    expect(eng.getCellValue(2, 2)).toBe("D");
  });

  it("pasteFromExternal prefers HTML over text", () => {
    const eng = new WorkbookEngine();
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.pasteFromExternal({
      html: "<table><tr><td>from-html</td></tr></table>",
      text: "from-text",
    });
    expect(eng.getCellValue(0, 0)).toBe("from-html");
  });

  it("parseClipboardPayload returns null for empty", () => {
    expect(parseClipboardPayload({})).toBeNull();
  });

  it("getClipboardTsv/Html after copy", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "hi" });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [0, 0], column: [0, 0] }],
    });
    eng.copySelection();
    expect(eng.getClipboardTsv()).toBe("hi");
    expect(eng.getClipboardHtml()).toContain("<td>hi</td>");
  });

  it("extractMerges only fully-contained merges as relative", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "mergeCells", row: 1, col: 1, rowCount: 2, colCount: 2 });
    const merges = extractMerges(eng.workbook.getActiveSheet(), {
      row: [1, 2],
      column: [1, 2],
    });
    expect(merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 2 }]);
  });

  it("paste restores merges at anchor", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "a" });
    eng.execute({ type: "mergeCells", row: 0, col: 0, rowCount: 2, colCount: 1 });
    eng.execute({ type: "setSelection", selection: [{ row: [0, 1], column: [0, 0] }] });
    eng.copySelection();
    eng.execute({ type: "setSelection", selection: [{ row: [0, 0], column: [2, 2] }] });
    eng.pasteAtSelection();
    const m = eng.workbook.getActiveSheet().getMergeAt(0, 2);
    expect(m).toEqual(expect.objectContaining({ r: 0, c: 2, rs: 2, cs: 1 }));
  });

  it("copy merge when selection is a single cell inside merge", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "merged" });
    eng.execute({ type: "mergeCells", row: 0, col: 0, rowCount: 2, colCount: 2 });
    eng.execute({
      type: "setSelection",
      selection: [{ row: [1, 1], column: [1, 1], row_focus: 1, column_focus: 1 }],
    });
    eng.copySelection();
    expect(eng.workbook.clipboard?.cells).toHaveLength(2);
    expect(eng.workbook.clipboard?.cells[0][0]?.v).toBe("merged");
    expect(eng.workbook.clipboard?.merges).toEqual([
      { r: 0, c: 0, rs: 2, cs: 2 },
    ]);
    eng.execute({
      type: "setSelection",
      selection: [{ row: [5, 5], column: [5, 5] }],
    });
    eng.pasteAtSelection();
    expect(eng.getCellValue(5, 5)).toBe("merged");
    expect(eng.workbook.getActiveSheet().getMergeAt(5, 5)).toMatchObject({
      rs: 2,
      cs: 2,
    });
  });

  it("pasteFromExternal applies merges from HTML", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setSelection", selection: [{ row: [0, 0], column: [0, 0] }] });
    eng.pasteFromExternal({
      html: `<table><tr><td rowspan="2">X</td><td>Y</td></tr><tr><td>Z</td></tr></table>`,
    });
    expect(eng.getCellValue(0, 0)).toBe("X");
    expect(eng.workbook.getActiveSheet().getMergeAt(0, 0)?.rs).toBe(2);
  });
});
