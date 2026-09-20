import type { AstNode } from "./parser.js";
import type { Workbook } from "../model/workbook.js";

export type FormulaValue = number | string | boolean | null;
export type FormulaError = { error: string };

export function isError(v: unknown): v is FormulaError {
  return typeof v === "object" && v != null && "error" in v;
}

export type EvalContext = {
  workbook: Workbook;
  sheetIndex: string | number;
  /** avoid circular refs */
  stack: Set<string>;
};

export function getCellRaw(
  ctx: EvalContext,
  row: number,
  col: number,
): FormulaValue | FormulaError {
  const cell = ctx.workbook.getCell(row, col, ctx.sheetIndex);
  if (!cell) return null;
  if (cell.v == null) return null;
  return cell.v as FormulaValue;
}

export function toNumber(v: FormulaValue | FormulaError): number | FormulaError {
  if (isError(v)) return v;
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  if (Number.isNaN(n)) return { error: "#VALUE!" };
  return n;
}

export function toString(v: FormulaValue | FormulaError): string | FormulaError {
  if (isError(v)) return v;
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

export function flattenArgs(
  args: AstNode[],
  evalNode: (n: AstNode) => FormulaValue | FormulaError | FormulaValue[],
): Array<FormulaValue | FormulaError> {
  const out: Array<FormulaValue | FormulaError> = [];
  for (const a of args) {
    const v = evalNode(a);
    if (Array.isArray(v)) out.push(...v);
    else out.push(v);
  }
  return out;
}

export type BuiltinFn = (
  args: AstNode[],
  evalNode: (n: AstNode) => FormulaValue | FormulaError | FormulaValue[],
  ctx: EvalContext,
) => FormulaValue | FormulaError;

export const builtins: Record<string, BuiltinFn> = {
  SUM(args, evalNode) {
    let sum = 0;
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) return v;
      const n = toNumber(v);
      if (isError(n)) continue;
      sum += n;
    }
    return sum;
  },
  AVERAGE(args, evalNode) {
    let sum = 0;
    let count = 0;
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) return v;
      if (v == null || v === "") continue;
      const n = toNumber(v);
      if (isError(n)) continue;
      sum += n;
      count++;
    }
    if (count === 0) return { error: "#DIV/0!" };
    return sum / count;
  },
  COUNT(args, evalNode) {
    let count = 0;
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) continue;
      if (typeof v === "number") count++;
      else if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) count++;
    }
    return count;
  },
  COUNTA(args, evalNode) {
    let count = 0;
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) continue;
      if (v != null && v !== "") count++;
    }
    return count;
  },
  MAX(args, evalNode) {
    let max = -Infinity;
    let any = false;
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) return v;
      const n = toNumber(v);
      if (isError(n)) continue;
      if (v == null || v === "") continue;
      max = Math.max(max, n);
      any = true;
    }
    return any ? max : 0;
  },
  MIN(args, evalNode) {
    let min = Infinity;
    let any = false;
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) return v;
      const n = toNumber(v);
      if (isError(n)) continue;
      if (v == null || v === "") continue;
      min = Math.min(min, n);
      any = true;
    }
    return any ? min : 0;
  },
  IF(args, evalNode) {
    if (args.length < 2) return { error: "#N/A" };
    const cond = evalNode(args[0]);
    if (Array.isArray(cond)) return { error: "#VALUE!" };
    if (isError(cond)) return cond;
    const truthy =
      cond === true ||
      (typeof cond === "number" && cond !== 0) ||
      (typeof cond === "string" && cond !== "" && cond !== "FALSE");
    const branch = truthy ? args[1] : args[2] ?? { type: "bool" as const, value: false };
    const r = evalNode(branch);
    return Array.isArray(r) ? r[0] ?? null : r;
  },
  AND(args, evalNode) {
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) return v;
      if (!v) return false;
    }
    return true;
  },
  OR(args, evalNode) {
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) return v;
      if (v) return true;
    }
    return false;
  },
  NOT(args, evalNode) {
    const v = evalNode(args[0]);
    if (Array.isArray(v)) return { error: "#VALUE!" };
    if (isError(v)) return v;
    return !v;
  },
  ROUND(args, evalNode) {
    const n = toNumber(evalNode(args[0]) as FormulaValue);
    if (isError(n)) return n;
    const d = args[1] ? toNumber(evalNode(args[1]) as FormulaValue) : 0;
    if (isError(d)) return d;
    const f = 10 ** d;
    return Math.round(n * f) / f;
  },
  ABS(args, evalNode) {
    const n = toNumber(evalNode(args[0]) as FormulaValue);
    if (isError(n)) return n;
    return Math.abs(n);
  },
  LEN(args, evalNode) {
    const s = toString(evalNode(args[0]) as FormulaValue);
    if (isError(s)) return s;
    return s.length;
  },
  TRIM(args, evalNode) {
    const s = toString(evalNode(args[0]) as FormulaValue);
    if (isError(s)) return s;
    return s.trim().replace(/\s+/g, " ");
  },
  CONCAT(args, evalNode) {
    let out = "";
    for (const v of flattenArgs(args, evalNode)) {
      if (isError(v)) return v;
      const s = toString(v);
      if (isError(s)) return s;
      out += s;
    }
    return out;
  },
  LEFT(args, evalNode) {
    const s = toString(evalNode(args[0]) as FormulaValue);
    if (isError(s)) return s;
    const n = args[1] ? toNumber(evalNode(args[1]) as FormulaValue) : 1;
    if (isError(n)) return n;
    return s.slice(0, n);
  },
  RIGHT(args, evalNode) {
    const s = toString(evalNode(args[0]) as FormulaValue);
    if (isError(s)) return s;
    const n = args[1] ? toNumber(evalNode(args[1]) as FormulaValue) : 1;
    if (isError(n)) return n;
    return s.slice(-n);
  },
  VLOOKUP(args, evalNode, ctx) {
    if (args.length < 3) return { error: "#N/A" };
    const lookup = evalNode(args[0]);
    if (Array.isArray(lookup) || isError(lookup)) return isError(lookup) ? lookup : { error: "#VALUE!" };
    const rangeNode = args[1];
    if (rangeNode.type !== "range") return { error: "#VALUE!" };
    const colIdx = toNumber(evalNode(args[2]) as FormulaValue);
    if (isError(colIdx)) return colIdx;
    const col = rangeNode.c1 + colIdx - 1;
    if (col < rangeNode.c1 || col > rangeNode.c2) return { error: "#REF!" };
    for (let r = rangeNode.r1; r <= rangeNode.r2; r++) {
      const key = getCellRaw(ctx, r, rangeNode.c1);
      if (key === lookup || String(key) === String(lookup)) {
        return getCellRaw(ctx, r, col);
      }
    }
    return { error: "#N/A" };
  },
  INDEX(args, evalNode, ctx) {
    if (args.length < 2) return { error: "#N/A" };
    const rangeNode = args[0];
    if (rangeNode.type !== "range" && rangeNode.type !== "ref") return { error: "#VALUE!" };
    const rowOff = toNumber(evalNode(args[1]) as FormulaValue);
    if (isError(rowOff)) return rowOff;
    const colOff = args[2] ? toNumber(evalNode(args[2]) as FormulaValue) : 1;
    if (isError(colOff)) return colOff;
    if (rangeNode.type === "ref") {
      return getCellRaw(ctx, rangeNode.row, rangeNode.col);
    }
    const r = rangeNode.r1 + rowOff - 1;
    const c = rangeNode.c1 + colOff - 1;
    if (r < rangeNode.r1 || r > rangeNode.r2 || c < rangeNode.c1 || c > rangeNode.c2) {
      return { error: "#REF!" };
    }
    return getCellRaw(ctx, r, c);
  },
  MATCH(args, evalNode, ctx) {
    if (args.length < 2) return { error: "#N/A" };
    const lookup = evalNode(args[0]);
    if (Array.isArray(lookup) || isError(lookup)) return isError(lookup) ? lookup : { error: "#VALUE!" };
    const rangeNode = args[1];
    if (rangeNode.type !== "range") return { error: "#VALUE!" };
    let i = 1;
    for (let r = rangeNode.r1; r <= rangeNode.r2; r++) {
      for (let c = rangeNode.c1; c <= rangeNode.c2; c++) {
        const v = getCellRaw(ctx, r, c);
        if (v === lookup || String(v) === String(lookup)) return i;
        i++;
      }
    }
    return { error: "#N/A" };
  },
  TODAY() {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 + 25569;
  },
  NOW() {
    return Date.now() / 86400000 + 25569;
  },
};
