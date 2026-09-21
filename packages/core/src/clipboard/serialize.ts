import type { RelativeMerge } from "./clipboard.js";
import type { CellData } from "../model/cell.js";
import { displayValue } from "../model/cell.js";

export type ClipboardParseResult = {
  cells: Array<Array<CellData | null>>;
  merges: RelativeMerge[];
};

/** Serialize a cell matrix to tab-separated values (Excel-compatible). */
export function cellsToTsv(cells: Array<Array<CellData | null>>): string {
  return cells
    .map((row) =>
      row
        .map((cell) => {
          if (!cell) return "";
          const text = displayValue(cell);
          if (/[\t\r\n"]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        })
        .join("\t"),
    )
    .join("\n");
}

/** Parse TSV / clipboard plain text into a cell matrix. */
export function parseTsv(text: string): Array<Array<CellData | null>> {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const body =
    normalized.endsWith("\n") && normalized.length > 0
      ? normalized.slice(0, -1)
      : normalized;
  if (body === "") return [[null]];

  const rows = splitTsvRows(body);
  return rows.map((line) => line.map(cellFromPlainText));
}

/** HTML table for system clipboard with optional merges and inline styles. */
export function cellsToHtml(
  cells: Array<Array<CellData | null>>,
  merges?: RelativeMerge[],
): string {
  const covered = new Set<string>();
  for (const m of merges ?? []) {
    for (let dr = 0; dr < m.rs; dr++) {
      for (let dc = 0; dc < m.cs; dc++) {
        if (dr === 0 && dc === 0) continue;
        covered.add(`${m.r + dr},${m.c + dc}`);
      }
    }
  }
  const rows = cells
    .map((row, ri) => {
      const tds: string[] = [];
      for (let ci = 0; ci < row.length; ci++) {
        if (covered.has(`${ri},${ci}`)) continue;
        const cell = row[ci];
        const merge = merges?.find((m) => m.r === ri && m.c === ci);
        const attrs: string[] = [];
        if (merge && merge.rs > 1) attrs.push(`rowspan="${merge.rs}"`);
        if (merge && merge.cs > 1) attrs.push(`colspan="${merge.cs}"`);
        const style = cell ? formatInlineStyle(cell) : "";
        if (style) attrs.push(`style="${style}"`);
        const text = cell ? escapeHtml(displayValue(cell)) : "";
        tds.push(`<td${attrs.length ? " " + attrs.join(" ") : ""}>${text}</td>`);
      }
      return `<tr>${tds.join("")}</tr>`;
    })
    .join("");
  return `<table>${rows}</table>`;
}

/** Parse HTML table with styles and rowspan/colspan. */
export function parseHtmlTable(html: string): ClipboardParseResult {
  const tableMatch = /<table[\s\S]*?<\/table>/i.exec(html);
  const src = tableMatch?.[0] ?? html;
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  const grid = new Map<string, CellData | null>();
  const occupied = new Set<string>();
  const merges: RelativeMerge[] = [];
  let maxRow = 0;
  let maxCol = 0;

  let tr: RegExpExecArray | null;
  let rIdx = 0;
  while ((tr = trRe.exec(src))) {
    const tdRe = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
    let col = 0;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(tr[0]))) {
      while (occupied.has(`${rIdx},${col}`)) col++;
      const attrs = td[1];
      const rs = Math.max(1, parseIntAttr(attrs, "rowspan"));
      const cs = Math.max(1, parseIntAttr(attrs, "colspan"));
      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          occupied.add(`${rIdx + dr},${col + dc}`);
        }
      }
      const text = decodeHtml(stripTags(td[2])).replace(/\u00a0/g, " ");
      const styleCell = parseInlineStyle(attrs);
      let cell: CellData | null = null;
      if (text !== "" || Object.keys(styleCell).length > 0) {
        cell = { ...styleCell, ...cellFromPlainText(text || "") };
        if (text === "") {
          cell.v = "";
          cell.m = "";
        }
      }
      grid.set(`${rIdx},${col}`, cell);
      if (rs > 1 || cs > 1) {
        merges.push({ r: rIdx, c: col, rs, cs });
      }
      maxRow = Math.max(maxRow, rIdx + rs - 1);
      maxCol = Math.max(maxCol, col + cs - 1);
      col += cs;
    }
    rIdx++;
  }

  const cells: Array<Array<CellData | null>> = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: Array<CellData | null> = [];
    for (let c = 0; c <= maxCol; c++) {
      const key = `${r},${c}`;
      if (grid.has(key)) row.push(grid.get(key) ?? null);
      else if (occupied.has(key)) row.push(null);
      else row.push(null);
    }
    cells.push(row);
  }
  if (cells.length === 0) return { cells: [], merges: [] };
  return { cells, merges };
}

/** Prefer HTML table when present; otherwise TSV / plain text. */
export function parseClipboardPayload(input: {
  html?: string;
  text?: string;
}): ClipboardParseResult | null {
  if (input.html) {
    const fromHtml = parseHtmlTable(input.html);
    if (fromHtml.cells.length > 0) return fromHtml;
  }
  if (input.text != null && input.text !== "") {
    return { cells: parseTsv(input.text), merges: [] };
  }
  return null;
}

function cellFromPlainText(text: string): CellData {
  const trimmed = text.trim();
  if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return { v: n, m: trimmed, ct: { fa: "General", t: "n" } };
  }
  return { v: text, m: text, ct: { fa: "General", t: "g" } };
}

function parseIntAttr(attrs: string, name: string): number {
  const m = new RegExp(`${name}\\s*=\\s*"?([0-9]+)"?`, "i").exec(attrs);
  return m ? Number(m[1]) : 1;
}

function parseInlineStyle(attrs: string): Partial<CellData> {
  const styleMatch = /style\s*=\s*"([^"]*)"/i.exec(attrs);
  if (!styleMatch) return {};
  return parseStyleString(styleMatch[1]);
}

function parseStyleString(style: string): Partial<CellData> {
  const out: Partial<CellData> = {};
  const parts = style.split(";").map((s) => s.trim()).filter(Boolean);
  let borderColor: string | undefined;
  let hasBorder = false;
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (prop === "background" || prop === "background-color") {
      const c = normalizeColor(val);
      if (c) out.bg = c;
    } else if (prop === "color") {
      const c = normalizeColor(val);
      if (c) out.fc = c;
    } else if (prop === "font-weight") {
      if (val === "bold" || Number(val) >= 700) out.bl = 1;
    } else if (prop === "font-style" && val === "italic") {
      out.it = 1;
    } else if (prop === "text-decoration") {
      const dec = val.toLowerCase();
      if (dec.includes("underline")) out.un = 1;
      if (dec.includes("line-through")) out.cl = 1;
    } else if (prop === "font-size") {
      const fs = parseFontSize(val);
      if (fs) out.fs = fs;
    } else if (prop === "text-align") {
      if (val === "left") out.ht = 1;
      else if (val === "center") out.ht = 0;
      else if (val === "right") out.ht = 2;
    } else if (prop.startsWith("border")) {
      hasBorder = true;
      const c = normalizeColor(val.split(/\s+/).pop() ?? "");
      if (c) borderColor = c;
    }
  }
  if (hasBorder) {
    const side = { style: 1, color: borderColor ?? "#000000" };
    out.bd = { t: side, b: side, l: side, r: side };
  }
  return out;
}

function formatInlineStyle(cell: CellData): string {
  const bits: string[] = [];
  if (cell.bg) bits.push(`background-color:${cell.bg}`);
  if (cell.fc) bits.push(`color:${cell.fc}`);
  if (cell.bl) bits.push("font-weight:bold");
  if (cell.it) bits.push("font-style:italic");
  const deco: string[] = [];
  if (cell.un) deco.push("underline");
  if (cell.cl) deco.push("line-through");
  if (deco.length) bits.push(`text-decoration:${deco.join(" ")}`);
  if (cell.fs) bits.push(`font-size:${cell.fs}pt`);
  if (cell.ht === 1) bits.push("text-align:left");
  else if (cell.ht === 0) bits.push("text-align:center");
  else if (cell.ht === 2) bits.push("text-align:right");
  if (cell.bd?.t) bits.push(`border:1px solid ${cell.bd.t.color}`);
  return bits.join(";");
}

function normalizeColor(raw: string): string | undefined {
  const v = raw.trim().toLowerCase();
  if (!v || v === "transparent") return undefined;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  const rgb = /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(v);
  if (rgb) {
    const h = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${h(rgb[1])}${h(rgb[2])}${h(rgb[3])}`;
  }
  return undefined;
}

function parseFontSize(val: string): number | undefined {
  const pt = /^([\d.]+)\s*pt$/i.exec(val);
  if (pt) return Math.round(Number(pt[1]));
  const px = /^([\d.]+)\s*px$/i.exec(val);
  if (px) return Math.round(Number(px[1]) / 1.33);
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function splitTsvRows(body: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === "\t") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&");
}
