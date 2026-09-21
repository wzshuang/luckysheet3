/** Cell key helpers: sparse storage uses "r_c" string keys. */

import type { SelectionRange } from "./workbook.js";
import type { Sheet } from "./sheet.js";
import { getFocusCell } from "../selection/range.js";

export function cellKey(row: number, col: number): string {
  return `${row}_${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const i = key.indexOf("_");
  return {
    row: Number(key.slice(0, i)),
    col: Number(key.slice(i + 1)),
  };
}

/** 0-based column index → A, B, … Z, AA, … */
export function colToLetter(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** A1 → { row: 0, col: 0 } */
export function parseA1(ref: string): { row: number; col: number } {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref.trim());
  if (!m) throw new Error(`Invalid cell ref: ${ref}`);
  const letters = m[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: Number(m[2]) - 1, col: col - 1 };
}

export function toA1(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

/**
 * Selection → label:
 * - single / merge-focus: "A1"
 * - range: "A1:B3"
 * - row_select: "3:5"
 * - column_select: "B:D"
 */
export function selectionToLabel(
  sel: SelectionRange,
  sheet?: Sheet,
): string {
  if (sel.row_select && !sel.column_select) {
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    return r0 === r1 ? `${r0 + 1}:${r0 + 1}` : `${r0 + 1}:${r1 + 1}`;
  }
  if (sel.column_select && !sel.row_select) {
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    return c0 === c1
      ? `${colToLetter(c0)}:${colToLetter(c0)}`
      : `${colToLetter(c0)}:${colToLetter(c1)}`;
  }

  const focus = getFocusCell(sel);
  if (sheet) {
    const merge = sheet.getMergeAt(focus.row, focus.col);
    if (merge) {
      const r0 = Math.min(sel.row[0], sel.row[1]);
      const r1 = Math.max(sel.row[0], sel.row[1]);
      const c0 = Math.min(sel.column[0], sel.column[1]);
      const c1 = Math.max(sel.column[0], sel.column[1]);
      // Exact merge block or single focus inside merge → show focus cell
      if (
        (r0 === merge.r &&
          r1 === merge.r + merge.rs - 1 &&
          c0 === merge.c &&
          c1 === merge.c + merge.cs - 1) ||
        (r0 === r1 && c0 === c1)
      ) {
        return toA1(merge.r, merge.c);
      }
    }
  }

  const r0 = Math.min(sel.row[0], sel.row[1]);
  const r1 = Math.max(sel.row[0], sel.row[1]);
  const c0 = Math.min(sel.column[0], sel.column[1]);
  const c1 = Math.max(sel.column[0], sel.column[1]);
  const start = toA1(r0, c0);
  if (r0 === r1 && c0 === c1) return start;
  return `${start}:${toA1(r1, c1)}`;
}
