import { describe, expect, it } from "vitest";
import { Workbook } from "../src/model/workbook.js";
import { Sheet } from "../src/model/sheet.js";
import { cellKey, parseA1, toA1 } from "../src/model/cell-key.js";

describe("cell-key", () => {
  it("roundtrips A1", () => {
    expect(toA1(0, 0)).toBe("A1");
    expect(toA1(0, 25)).toBe("Z1");
    expect(toA1(0, 26)).toBe("AA1");
    expect(parseA1("B2")).toEqual({ row: 1, col: 1 });
    expect(parseA1("$C$10")).toEqual({ row: 9, col: 2 });
  });

  it("builds sparse keys", () => {
    expect(cellKey(3, 5)).toBe("3_5");
  });
});

describe("Sheet sparse model", () => {
  it("stores cells sparsely", () => {
    const sheet = new Sheet({ name: "S", index: 0 });
    expect(sheet.getCell(0, 0)).toBeNull();
    sheet.setCell(0, 0, { v: 1, m: "1" });
    expect(sheet.getCell(0, 0)?.v).toBe(1);
    expect(sheet.cellCount).toBe(1);
    sheet.setCell(0, 0, null);
    expect(sheet.cellCount).toBe(0);
  });

  it("tracks merge coverage", () => {
    const sheet = new Sheet({
      name: "S",
      index: 0,
      config: { merge: { "1_1": { r: 1, c: 1, rs: 2, cs: 2 } } },
    });
    expect(sheet.isMergeCovered(1, 1)).toBe(false);
    expect(sheet.isMergeCovered(2, 2)).toBe(true);
    expect(sheet.getMergeAt(2, 1)?.r).toBe(1);
  });
});

describe("Workbook", () => {
  it("loads multiple sheets and switches", () => {
    const wb = new Workbook([
      { name: "A", index: 0, order: 0, status: 1, celldata: [], config: {} },
      { name: "B", index: 1, order: 1, status: 0, celldata: [], config: {} },
    ]);
    expect(wb.getActiveSheet().name).toBe("A");
    wb.switchSheet(1);
    expect(wb.getActiveSheet().name).toBe("B");
  });

  it("setCell emits change", () => {
    const wb = new Workbook();
    const events: string[] = [];
    wb.on((e) => events.push(e.type));
    wb.setCell(0, 0, { v: 42, m: "42" });
    expect(wb.getCell(0, 0)?.v).toBe(42);
    expect(events).toContain("change");
  });

  it("expands row/col count on set", () => {
    const wb = new Workbook();
    wb.setCell(100, 50, { v: 1, m: "1" });
    expect(wb.getActiveSheet().rowCount).toBeGreaterThanOrEqual(101);
    expect(wb.getActiveSheet().colCount).toBeGreaterThanOrEqual(51);
  });
});
