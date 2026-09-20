import type { Cell, CellData, CellType } from "../model/cell.js";
import { displayValue } from "../model/cell.js";

export type FormatPresetId =
  | "general"
  | "number"
  | "percent"
  | "currency"
  | "date"
  | "text";

export type FormatPreset = {
  id: FormatPresetId;
  label: string;
  fa: string;
  t: string;
};

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: "general", label: "General", fa: "General", t: "g" },
  { id: "number", label: "Number", fa: "0.00", t: "n" },
  { id: "percent", label: "Percent", fa: "0%", t: "n" },
  { id: "currency", label: "Currency", fa: "¥#,##0.00", t: "n" },
  { id: "date", label: "Date", fa: "yyyy-MM-dd", t: "d" },
  { id: "text", label: "Text", fa: "@", t: "s" },
];

export function presetById(id: FormatPresetId): FormatPreset {
  return FORMAT_PRESETS.find((p) => p.id === id) ?? FORMAT_PRESETS[0];
}

export function presetByFa(fa: string | undefined | null): FormatPreset {
  if (!fa) return FORMAT_PRESETS[0];
  return FORMAT_PRESETS.find((p) => p.fa === fa) ?? FORMAT_PRESETS[0];
}

/** Format raw cell value to display string `m` */
export function formatDisplay(
  value: unknown,
  ct: CellType | null | undefined,
): string {
  if (value == null || value === "") return "";
  const fa = ct?.fa ?? "General";
  const t = ct?.t;

  if (fa === "@" || t === "s") return String(value);

  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  if (fa === "0%" || fa.includes("%")) {
    const n = toNumber(value);
    if (n == null) return String(value);
    const pct = n * 100;
    const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, "");
    return `${text}%`;
  }

  if (fa === "0.00" || /^0\.0+$/.test(fa)) {
    const n = toNumber(value);
    if (n == null) return String(value);
    const decimals = (fa.split(".")[1] ?? "00").length;
    return n.toFixed(decimals);
  }

  if (fa.includes("#,##0") || fa.includes("¥") || fa.includes("$")) {
    const n = toNumber(value);
    if (n == null) return String(value);
    const fixed = n.toFixed(2);
    const [intPart, dec] = fixed.split(".");
    const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const prefix = fa.includes("¥") ? "¥" : fa.includes("$") ? "$" : "";
    return `${prefix}${withComma}.${dec}`;
  }

  if (fa === "yyyy-MM-dd" || t === "d") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const n = toNumber(value);
    if (n != null) {
      // Excel serial day approx from 1899-12-30
      const ms = Date.UTC(1899, 11, 30) + n * 86400000;
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${mo}-${day}`;
    }
    return String(value);
  }

  return String(value);
}

export function applyFormatToCell(
  cell: CellData | null,
  preset: FormatPreset,
): CellData {
  const base: CellData = { ...(cell ?? {}) };
  let v = base.v;
  if (preset.id === "percent" && typeof v === "number" && Math.abs(v) > 1) {
    // treat 50 as 50% → store 0.5
    v = v / 100;
  }
  if (preset.id === "number" || preset.id === "currency") {
    const n = toNumber(v ?? displayValue(base));
    if (n != null) v = n;
  }
  if (preset.id === "general" && typeof v === "string") {
    const n = toNumber(v);
    if (n != null && /^-?\d+(\.\d+)?$/.test(v.trim())) v = n;
  }
  const ct: CellType = {
    fa: preset.fa,
    t:
      preset.id === "general"
        ? typeof v === "number"
          ? "n"
          : "g"
        : preset.t,
  };
  const m = formatDisplay(v, ct);
  return { ...base, v: v ?? null, m, ct, f: base.f ?? null };
}

export function clearCellFormat(cell: CellData | null): CellData | null {
  if (!cell) return null;
  const next: CellData = {
    v: cell.v,
    m: cell.v == null ? null : String(cell.v),
    f: cell.f,
    ct: { fa: "General", t: typeof cell.v === "number" ? "n" : "g" },
  };
  if (cell.extras) next.extras = cell.extras;
  return next;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function activeCellFormatId(cell: Cell): FormatPresetId {
  return presetByFa(cell?.ct?.fa).id;
}
