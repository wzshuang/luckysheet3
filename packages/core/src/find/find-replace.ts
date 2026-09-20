import type { Workbook } from "../model/workbook.js";
import { displayValue } from "../model/cell.js";

export type FindOptions = {
  matchCase?: boolean;
  /** start after this cell */
  afterRow?: number;
  afterCol?: number;
};

export function findNext(
  workbook: Workbook,
  query: string,
  opts: FindOptions = {},
): { row: number; col: number } | null {
  if (!query) return null;
  const sheet = workbook.getActiveSheet();
  const q = opts.matchCase ? query : query.toLowerCase();
  const startR = opts.afterRow ?? 0;
  const startC = (opts.afterCol ?? -1) + 1;

  const scan = (r0: number, c0: number, toEnd: boolean) => {
    for (let r = r0; r < sheet.rowCount; r++) {
      if (sheet.hiddenRows.has(r)) continue;
      const cStart = r === r0 ? c0 : 0;
      for (let c = cStart; c < sheet.colCount; c++) {
        const text = displayValue(sheet.getCell(r, c));
        const hay = opts.matchCase ? text : text.toLowerCase();
        if (hay.includes(q)) return { row: r, col: c };
      }
      if (!toEnd && r > startR + 50 && r0 === startR) break;
    }
    return null;
  };

  return (
    scan(startR, startC, true) ??
    scan(0, 0, true)
  );
}

export function collectColumnValues(workbook: Workbook, col: number): string[] {
  const sheet = workbook.getActiveSheet();
  const set = new Set<string>();
  for (let r = 0; r < sheet.rowCount; r++) {
    const cell = sheet.getCell(r, col);
    if (cell == null) {
      set.add("");
      continue;
    }
    set.add(displayValue(cell));
  }
  return [...set].sort();
}
