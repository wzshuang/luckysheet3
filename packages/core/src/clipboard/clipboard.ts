import type { CellData } from "../model/cell.js";
import { cloneCell, displayValue } from "../model/cell.js";
import type { Sheet } from "../model/sheet.js";
import type { SelectionRange } from "../model/workbook.js";

export type RelativeMerge = {
  r: number;
  c: number;
  rs: number;
  cs: number;
};

export type ClipboardPayload = {
  cells: Array<Array<CellData | null>>;
  cut?: boolean;
  from: SelectionRange;
  merges?: RelativeMerge[];
};

/** Merges fully contained in range, relative to range top-left. */
export function extractMerges(
  sheet: Sheet,
  range: SelectionRange,
): RelativeMerge[] {
  const r0 = Math.min(range.row[0], range.row[1]);
  const r1 = Math.max(range.row[0], range.row[1]);
  const c0 = Math.min(range.column[0], range.column[1]);
  const c1 = Math.max(range.column[0], range.column[1]);
  const merge = sheet.config.merge;
  if (!merge) return [];
  const out: RelativeMerge[] = [];
  for (const m of Object.values(merge)) {
    if (
      m.r >= r0 &&
      m.r + m.rs - 1 <= r1 &&
      m.c >= c0 &&
      m.c + m.cs - 1 <= c1
    ) {
      out.push({ r: m.r - r0, c: m.c - c0, rs: m.rs, cs: m.cs });
    }
  }
  return out;
}

export function extractRange(
  sheet: Sheet,
  range: SelectionRange,
): Array<Array<CellData | null>> {
  const r0 = Math.min(range.row[0], range.row[1]);
  const r1 = Math.max(range.row[0], range.row[1]);
  const c0 = Math.min(range.column[0], range.column[1]);
  const c1 = Math.max(range.column[0], range.column[1]);
  const out: Array<Array<CellData | null>> = [];
  for (let r = r0; r <= r1; r++) {
    const row: Array<CellData | null> = [];
    for (let c = c0; c <= c1; c++) {
      const m = sheet.getMergeAt(r, c);
      if (m && (r !== m.r || c !== m.c)) {
        row.push(null);
      } else {
        row.push(cloneCell(sheet.getCell(r, c)));
      }
    }
    out.push(row);
  }
  return out;
}

/** Fill from source selection into expanded `to` selection */
export function fillRange(
  sheet: Sheet,
  from: SelectionRange,
  to: SelectionRange,
): void {
  const fr0 = Math.min(from.row[0], from.row[1]);
  const fr1 = Math.max(from.row[0], from.row[1]);
  const fc0 = Math.min(from.column[0], from.column[1]);
  const fc1 = Math.max(from.column[0], from.column[1]);
  const tr0 = Math.min(to.row[0], to.row[1]);
  const tr1 = Math.max(to.row[0], to.row[1]);
  const tc0 = Math.min(to.column[0], to.column[1]);
  const tc1 = Math.max(to.column[0], to.column[1]);

  const srcH = fr1 - fr0 + 1;
  const srcW = fc1 - fc0 + 1;

  // vertical fill (same columns)
  if (tc0 === fc0 && tc1 === fc1 && (tr1 > fr1 || tr0 < fr0)) {
    const series = detectSeriesAlong(sheet, fr0, fr1, fc0, "row");
    if (tr1 > fr1 && series) {
      for (let r = fr1 + 1; r <= tr1; r++) {
        const idx = r - fr0;
        sheet.setCell(r, fc0, seriesValue(series, idx));
      }
      return;
    }
    if (tr0 < fr0 && series) {
      for (let r = fr0 - 1; r >= tr0; r--) {
        const idx = r - fr0;
        sheet.setCell(r, fc0, seriesValue(series, idx));
      }
      return;
    }
  }

  // horizontal fill (same rows)
  if (tr0 === fr0 && tr1 === fr1 && (tc1 > fc1 || tc0 < fc0)) {
    const series = detectSeriesAlong(sheet, fc0, fc1, fr0, "col");
    if (tc1 > fc1 && series) {
      for (let c = fc1 + 1; c <= tc1; c++) {
        const idx = c - fc0;
        sheet.setCell(fr0, c, seriesValue(series, idx));
      }
      return;
    }
    if (tc0 < fc0 && series) {
      for (let c = fc0 - 1; c >= tc0; c--) {
        const idx = c - fc0;
        sheet.setCell(fr0, c, seriesValue(series, idx));
      }
      return;
    }
  }

  // generic tile copy
  for (let r = tr0; r <= tr1; r++) {
    for (let c = tc0; c <= tc1; c++) {
      if (r >= fr0 && r <= fr1 && c >= fc0 && c <= fc1) continue;
      const sr = fr0 + (((r - fr0) % srcH) + srcH) % srcH;
      const sc = fc0 + (((c - fc0) % srcW) + srcW) % srcW;
      sheet.setCell(r, c, cloneCell(sheet.getCell(sr, sc)));
    }
  }
}

type Series =
  | { kind: "number"; start: number; step: number }
  | { kind: "textNum"; prefix: string; start: number; step: number; pad: number }
  | { kind: "date"; startMs: number; stepDays: number };

function seriesValue(series: Series, idx: number): CellData {
  if (series.kind === "number") {
    const v = series.start + series.step * idx;
    return { v, m: String(v), ct: { fa: "General", t: "n" } };
  }
  if (series.kind === "textNum") {
    const n = series.start + series.step * idx;
    const num =
      series.pad > 0 ? String(n).padStart(series.pad, "0") : String(n);
    const m = `${series.prefix}${num}`;
    return { v: m, m, ct: { fa: "General", t: "g" } };
  }
  const d = new Date(series.startMs + series.stepDays * idx * 86400000);
  const m = formatDate(d);
  return { v: m, m, ct: { fa: "yyyy-MM-dd", t: "d" } };
}

/** Along a row (vary col) or along a column (vary row) */
function detectSeriesAlong(
  sheet: Sheet,
  a0: number,
  a1: number,
  fixed: number,
  axis: "row" | "col",
): Series | null {
  const cells: CellData[] = [];
  for (let i = a0; i <= a1; i++) {
    const cell =
      axis === "row" ? sheet.getCell(i, fixed) : sheet.getCell(fixed, i);
    if (!cell) return null;
    cells.push(cell);
  }
  if (cells.length === 0) return null;

  const numSeries = detectNumberSeries(cells);
  if (numSeries) return numSeries;
  const textSeries = detectTextNumSeries(cells);
  if (textSeries) return textSeries;
  const dateSeries = detectDateSeries(cells);
  if (dateSeries) return dateSeries;
  return null;
}

function detectNumberSeries(cells: CellData[]): Series | null {
  const vals: number[] = [];
  for (const cell of cells) {
    const raw = cell.v;
    if (typeof raw === "number") vals.push(raw);
    else {
      const n = Number(displayValue(cell));
      if (Number.isNaN(n) || displayValue(cell) === "") return null;
      vals.push(n);
    }
  }
  if (vals.length === 1) return { kind: "number", start: vals[0], step: 1 };
  const step = vals[1] - vals[0];
  for (let i = 2; i < vals.length; i++) {
    if (vals[i] - vals[i - 1] !== step) return null;
  }
  return { kind: "number", start: vals[0], step };
}

function detectTextNumSeries(cells: CellData[]): Series | null {
  const re = /^(.*?)(\d+)$/;
  const parsed: Array<{ prefix: string; n: number; pad: number }> = [];
  for (const cell of cells) {
    const text = displayValue(cell);
    const m = re.exec(text);
    if (!m) return null;
    parsed.push({
      prefix: m[1],
      n: Number(m[2]),
      pad: m[2].length,
    });
  }
  if (parsed.some((p) => p.prefix !== parsed[0].prefix)) return null;
  if (parsed.length === 1) {
    return {
      kind: "textNum",
      prefix: parsed[0].prefix,
      start: parsed[0].n,
      step: 1,
      pad: parsed[0].pad,
    };
  }
  const step = parsed[1].n - parsed[0].n;
  for (let i = 2; i < parsed.length; i++) {
    if (parsed[i].n - parsed[i - 1].n !== step) return null;
  }
  return {
    kind: "textNum",
    prefix: parsed[0].prefix,
    start: parsed[0].n,
    step,
    pad: parsed[0].pad,
  };
}

function detectDateSeries(cells: CellData[]): Series | null {
  const times: number[] = [];
  for (const cell of cells) {
    const t = parseDateMs(cell);
    if (t == null) return null;
    times.push(t);
  }
  if (times.length === 1) {
    return { kind: "date", startMs: times[0], stepDays: 1 };
  }
  const stepDays = Math.round((times[1] - times[0]) / 86400000);
  if (stepDays === 0) return null;
  for (let i = 2; i < times.length; i++) {
    const d = Math.round((times[i] - times[i - 1]) / 86400000);
    if (d !== stepDays) return null;
  }
  return { kind: "date", startMs: times[0], stepDays };
}

function parseDateMs(cell: CellData): number | null {
  if (cell.ct?.t === "d" && typeof cell.v === "number") {
    // Excel serial not fully supported; fall through to string
  }
  const text = displayValue(cell);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}
