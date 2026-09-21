import type { SelectionRange } from "../model/workbook.js";
import type { Sheet } from "../model/sheet.js";

export function normalizeRange(
  r: SelectionRange,
  sheet?: Sheet,
): SelectionRange {
  let r0 = Math.min(r.row[0], r.row[1]);
  let r1 = Math.max(r.row[0], r.row[1]);
  let c0 = Math.min(r.column[0], r.column[1]);
  let c1 = Math.max(r.column[0], r.column[1]);

  if (sheet) {
    const maxR = Math.max(0, sheet.rowCount - 1);
    const maxC = Math.max(0, sheet.colCount - 1);
    r0 = Math.max(0, Math.min(r0, maxR));
    r1 = Math.max(0, Math.min(r1, maxR));
    c0 = Math.max(0, Math.min(c0, maxC));
    c1 = Math.max(0, Math.min(c1, maxC));
  }

  const row_focus =
    r.row_focus != null
      ? Math.max(r0, Math.min(r.row_focus, r1))
      : r0;
  const column_focus =
    r.column_focus != null
      ? Math.max(c0, Math.min(r.column_focus, c1))
      : c0;

  return {
    row: [r0, r1],
    column: [c0, c1],
    row_focus,
    column_focus,
    ...(r.row_select ? { row_select: true } : {}),
    ...(r.column_select ? { column_select: true } : {}),
  };
}

/** Shift-extend: rectangle from anchor focus to (row, col) */
export function extendRange(
  anchor: SelectionRange,
  row: number,
  col: number,
  sheet?: Sheet,
): SelectionRange {
  const a = normalizeRange(anchor, sheet);
  const rf = a.row_focus ?? a.row[0];
  const cf = a.column_focus ?? a.column[0];
  return normalizeRange(
    {
      row: [rf, row],
      column: [cf, col],
      row_focus: rf,
      column_focus: cf,
      row_select: a.row_select,
      column_select: a.column_select,
    },
    sheet,
  );
}

export function rangesOverlap(a: SelectionRange, b: SelectionRange): boolean {
  const ar0 = Math.min(a.row[0], a.row[1]);
  const ar1 = Math.max(a.row[0], a.row[1]);
  const ac0 = Math.min(a.column[0], a.column[1]);
  const ac1 = Math.max(a.column[0], a.column[1]);
  const br0 = Math.min(b.row[0], b.row[1]);
  const br1 = Math.max(b.row[0], b.row[1]);
  const bc0 = Math.min(b.column[0], b.column[1]);
  const bc1 = Math.max(b.column[0], b.column[1]);
  return !(ar1 < br0 || br1 < ar0 || ac1 < bc0 || bc1 < ac0);
}

/** Merge consecutive indices into [start, end] segments */
export function selectTitlesRange(map: Record<number, 0>): Array<[number, number]> {
  const keys = Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b);
  if (keys.length === 0) return [];
  const out: Array<[number, number]> = [];
  let start = keys[0];
  let prev = keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (keys[i] === prev + 1) {
      prev = keys[i];
    } else {
      out.push([start, prev]);
      start = keys[i];
      prev = keys[i];
    }
  }
  out.push([start, prev]);
  return out;
}

export function aggregateRowColHeaders(ranges: SelectionRange[]): {
  rows: Array<[number, number]>;
  cols: Array<[number, number]>;
} {
  const rowMap: Record<number, 0> = {};
  const colMap: Record<number, 0> = {};
  for (const s of ranges) {
    const r0 = Math.min(s.row[0], s.row[1]);
    const r1 = Math.max(s.row[0], s.row[1]);
    const c0 = Math.min(s.column[0], s.column[1]);
    const c1 = Math.max(s.column[0], s.column[1]);
    for (let r = r0; r <= r1; r++) rowMap[r] = 0;
    for (let c = c0; c <= c1; c++) colMap[c] = 0;
  }
  return {
    rows: selectTitlesRange(rowMap),
    cols: selectTitlesRange(colMap),
  };
}

export function getFocusCell(range: SelectionRange): { row: number; col: number } {
  const n = normalizeRange(range);
  return {
    row: n.row_focus ?? n.row[0],
    col: n.column_focus ?? n.column[0],
  };
}

/**
 * Expand range to include full merge blocks that intersect it (for copy/paste).
 */
export function expandRangeForMerges(
  range: SelectionRange,
  sheet: Sheet,
): SelectionRange {
  let r0 = Math.min(range.row[0], range.row[1]);
  let r1 = Math.max(range.row[0], range.row[1]);
  let c0 = Math.min(range.column[0], range.column[1]);
  let c1 = Math.max(range.column[0], range.column[1]);
  const merge = sheet.config.merge;
  if (!merge) return normalizeRange(range, sheet);

  let changed = true;
  while (changed) {
    changed = false;
    for (const m of Object.values(merge)) {
      const mr1 = m.r + m.rs - 1;
      const mc1 = m.c + m.cs - 1;
      const overlaps =
        m.r <= r1 && mr1 >= r0 && m.c <= c1 && mc1 >= c0;
      if (!overlaps) continue;
      const nr0 = Math.min(r0, m.r);
      const nr1 = Math.max(r1, mr1);
      const nc0 = Math.min(c0, m.c);
      const nc1 = Math.max(c1, mc1);
      if (nr0 !== r0 || nr1 !== r1 || nc0 !== c0 || nc1 !== c1) {
        r0 = nr0;
        r1 = nr1;
        c0 = nc0;
        c1 = nc1;
        changed = true;
      }
    }
  }

  return normalizeRange(
    {
      row: [r0, r1],
      column: [c0, c1],
      row_focus: range.row_focus ?? r0,
      column_focus: range.column_focus ?? c0,
      row_select: range.row_select,
      column_select: range.column_select,
    },
    sheet,
  );
}
