import type { CellData } from "../model/cell.js";
import { displayValue } from "../model/cell.js";

/** Serialize a cell matrix to tab-separated values (Excel-compatible). */
export function cellsToTsv(cells: Array<Array<CellData | null>>): string {
  return cells
    .map((row) =>
      row
        .map((cell) => {
          if (!cell) return "";
          const text = displayValue(cell);
          // Escape tabs/newlines so a single cell stays one field
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

/** Minimal HTML table for system clipboard (Excel / Sheets paste). */
export function cellsToHtml(cells: Array<Array<CellData | null>>): string {
  const rows = cells
    .map((row) => {
      const tds = row
        .map((cell) => {
          const text = cell ? escapeHtml(displayValue(cell)) : "";
          return `<td>${text}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<table>${rows}</table>`;
}

/**
 * Parse HTML clipboard payload. Prefers `<table>` rows; falls back to
 * extracting `<tr>` / `<td>` / `<th>` anywhere in the fragment.
 */
export function parseHtmlTable(html: string): Array<Array<CellData | null>> {
  const tableMatch = /<table[\s\S]*?<\/table>/i.exec(html);
  const src = tableMatch?.[0] ?? html;
  const out: Array<Array<CellData | null>> = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(src))) {
    const row: Array<CellData | null> = [];
    const tdRe = /<t[dh](?:\s[^>]*)?>([\s\S]*?)<\/t[dh]>/gi;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(tr[0]))) {
      const text = decodeHtml(stripTags(td[1])).replace(/\u00a0/g, " ").trim();
      row.push(text === "" ? null : cellFromPlainText(text));
    }
    if (row.length > 0) out.push(row);
  }
  return out;
}

/** Prefer HTML table when present; otherwise TSV / plain text. */
export function parseClipboardPayload(input: {
  html?: string;
  text?: string;
}): Array<Array<CellData | null>> | null {
  if (input.html) {
    const fromHtml = parseHtmlTable(input.html);
    if (fromHtml.length > 0) return fromHtml;
  }
  if (input.text != null && input.text !== "") {
    return parseTsv(input.text);
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

/** Split TSV respecting double-quoted fields. */
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
