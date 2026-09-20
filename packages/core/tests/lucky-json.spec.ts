import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fromLuckyFile, toLuckyFile } from "../src/io/lucky-json.js";
import { Workbook } from "../src/model/workbook.js";

const fixturePath = resolve(__dirname, "../../../fixtures/lucky/sheet-mini.json");

describe("Lucky JSON IO", () => {
  it("loads fixture and preserves merge + cells", () => {
    const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));
    const snaps = fromLuckyFile([raw]);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].config.merge?.["2_1"]).toEqual({ r: 2, c: 1, rs: 2, cs: 2 });
    expect(snaps[0].extras?.color).toBe("");
    expect(snaps[0].extras?.zoomRatio).toBe(1);

    const wb = new Workbook(snaps);
    expect(wb.getCell(0, 0)?.v).toBe(1);
    expect(wb.getCell(0, 1)?.m).toBe("Hello");
    expect(wb.getActiveSheet().getMergeAt(3, 2)?.r).toBe(2);
  });

  it("roundtrips unknown fields via extras", () => {
    const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));
    const snaps = fromLuckyFile([raw]);
    const out = toLuckyFile(snaps);
    expect(out[0].zoomRatio).toBe(1);
    expect(out[0].celldata?.length).toBe(snaps[0].celldata.length);
    expect(out[0].config?.merge).toEqual(snaps[0].config.merge);
  });
});
