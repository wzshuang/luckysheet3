import type { CellData } from "../model/cell.js";
import { cloneCell } from "../model/cell.js";

export type CellFormat = Pick<
  CellData,
  "bg" | "fc" | "bl" | "it" | "fs" | "ff" | "ht" | "vt" | "bd" | "ct"
>;

const FORMAT_KEYS = [
  "bg",
  "fc",
  "bl",
  "it",
  "fs",
  "ff",
  "ht",
  "vt",
  "bd",
  "ct",
] as const;

export function stripValue(cell: CellData | null): CellData | null {
  if (!cell) return null;
  const cloned = cloneCell(cell)!;
  delete cloned.v;
  delete cloned.m;
  delete cloned.f;
  return cloned;
}

export function applyFormat(
  target: CellData | null,
  format: CellData | null,
): CellData | null {
  const base: CellData = target ? { ...cloneCell(target)! } : {};
  if (format == null) {
    for (const k of FORMAT_KEYS) delete (base as Record<string, unknown>)[k];
    if (
      base.v == null &&
      base.m == null &&
      base.f == null &&
      Object.keys(base).length === 0
    ) {
      return null;
    }
    return base;
  }
  const src = cloneCell(format)!;
  for (const k of FORMAT_KEYS) {
    if (src[k] !== undefined) {
      (base as Record<string, unknown>)[k] = src[k];
    }
  }
  return base;
}

export function extractFormatMatrix(
  cells: Array<Array<CellData | null>>,
): Array<Array<CellData | null>> {
  return cells.map((row) => row.map(stripValue));
}
