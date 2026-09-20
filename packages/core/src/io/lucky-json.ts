import type { SheetSnapshot } from "../model/sheet.js";
import type { CellData } from "../model/cell.js";

/** Raw Luckysheet sheet object (subset + extras) */
export type LuckySheetRaw = {
  name?: string;
  index?: string | number;
  order?: number | string;
  status?: number | string;
  celldata?: Array<{ r: number; c: number; v: CellData | null }>;
  data?: Array<Array<CellData | null>>;
  config?: Record<string, unknown>;
  row?: number;
  column?: number;
  [key: string]: unknown;
};

const KNOWN = new Set([
  "name",
  "index",
  "order",
  "status",
  "celldata",
  "data",
  "config",
  "row",
  "column",
]);

export function fromLuckyFile(raw: LuckySheetRaw[] | LuckySheetRaw): SheetSnapshot[] {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((sheet, i) => {
    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sheet)) {
      if (!KNOWN.has(k)) extras[k] = v;
    }

    let celldata =
      sheet.celldata
        ?.filter((c) => c && c.v != null)
        .map((c) => ({ r: c.r, c: c.c, v: c.v as CellData })) ?? [];

    if ((!celldata.length || celldata.length === 0) && Array.isArray(sheet.data)) {
      celldata = [];
      for (let r = 0; r < sheet.data.length; r++) {
        const row = sheet.data[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const v = row[c];
          if (v != null) celldata.push({ r, c, v });
        }
      }
    }

    const config = { ...(sheet.config ?? {}) } as SheetSnapshot["config"];

    return {
      name: sheet.name ?? `Sheet${i + 1}`,
      index: sheet.index ?? i,
      order: Number(sheet.order ?? i),
      status: Number(sheet.status ?? (i === 0 ? 1 : 0)),
      celldata,
      config,
      row: sheet.row,
      column: sheet.column,
      extras,
    };
  });
}

export function toLuckyFile(snapshots: SheetSnapshot[]): LuckySheetRaw[] {
  return snapshots.map((s) => {
    const out: LuckySheetRaw = {
      name: s.name,
      index: s.index,
      order: s.order,
      status: s.status,
      celldata: s.celldata,
      config: s.config,
      row: s.row,
      column: s.column,
      ...(s.extras ?? {}),
    };
    return out;
  });
}
