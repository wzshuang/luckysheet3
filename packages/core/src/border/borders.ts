import type { BorderSide, CellBorder, CellData } from "../model/cell.js";
import { cloneCell } from "../model/cell.js";
import type { Sheet } from "../model/sheet.js";
import type { SelectionRange } from "../model/workbook.js";

export type BorderMode = "all" | "outside" | "none";

export type BorderInfoEntry = {
  rangeType: "range";
  borderType: string;
  color: string;
  style: number;
  range: Array<{ row: [number, number]; column: [number, number] }>;
};

function side(color: string, style: number): BorderSide {
  return { style, color };
}

function normalizeRange(range: SelectionRange) {
  return {
    r0: Math.min(range.row[0], range.row[1]),
    r1: Math.max(range.row[0], range.row[1]),
    c0: Math.min(range.column[0], range.column[1]),
    c1: Math.max(range.column[0], range.column[1]),
  };
}

function ensureCell(sheet: Sheet, row: number, col: number): CellData {
  return cloneCell(sheet.getCell(row, col)) ?? {};
}

function setBd(sheet: Sheet, row: number, col: number, bd: CellBorder | null): void {
  const cell = ensureCell(sheet, row, col);
  if (bd == null) {
    delete cell.bd;
    sheet.setCell(row, col, Object.keys(cell).length ? cell : null);
    return;
  }
  cell.bd = bd;
  sheet.setCell(row, col, cell);
}

function mergeBd(
  existing: CellBorder | null | undefined,
  patch: CellBorder,
): CellBorder {
  return { ...(existing ?? {}), ...patch };
}

/** Apply borders to selection cells; also records config.borderInfo */
export function applyBorders(
  sheet: Sheet,
  range: SelectionRange,
  mode: BorderMode,
  color = "#000000",
  style = 1,
): void {
  const { r0, r1, c0, c1 } = normalizeRange(range);
  const s = side(color, style);

  if (mode === "none") {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        setBd(sheet, r, c, null);
      }
    }
  } else if (mode === "all") {
    const full: CellBorder = { t: s, b: s, l: s, r: s };
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        setBd(sheet, r, c, full);
      }
    }
  } else {
    // outside
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const patch: CellBorder = {};
        if (r === r0) patch.t = s;
        if (r === r1) patch.b = s;
        if (c === c0) patch.l = s;
        if (c === c1) patch.r = s;
        if (Object.keys(patch).length === 0) continue;
        const cell = ensureCell(sheet, r, c);
        setBd(sheet, r, c, mergeBd(cell.bd, patch));
      }
    }
  }

  const borderType =
    mode === "all" ? "border-all" : mode === "outside" ? "border-outside" : "border-none";
  const entry: BorderInfoEntry = {
    rangeType: "range",
    borderType,
    color,
    style,
    range: [{ row: [r0, r1], column: [c0, c1] }],
  };
  const list = Array.isArray(sheet.config.borderInfo)
    ? ([...(sheet.config.borderInfo as BorderInfoEntry[])] as BorderInfoEntry[])
    : [];
  list.push(entry);
  sheet.config.borderInfo = list;
}
