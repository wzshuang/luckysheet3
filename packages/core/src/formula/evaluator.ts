import type { Workbook } from "../model/workbook.js";
import { cellKey } from "../model/cell-key.js";
import { Parser, collectRefs, type AstNode } from "./parser.js";
import {
  builtins,
  getCellRaw,
  isError,
  toNumber,
  toString,
  type EvalContext,
  type FormulaError,
  type FormulaValue,
} from "./functions.js";

type DepKey = string; // sheet:r_c

export class FormulaEngine {
  /** formula cell → dependencies */
  private deps = new Map<DepKey, Set<DepKey>>();
  /** dependency → formula cells that depend on it */
  private reverse = new Map<DepKey, Set<DepKey>>();

  constructor(private workbook: Workbook) {}

  private key(sheet: string | number, r: number, c: number): DepKey {
    return `${sheet}:${cellKey(r, c)}`;
  }

  private parseKey(k: DepKey): { sheet: string; row: number; col: number } {
    const [sheet, rest] = k.split(":");
    const i = rest.indexOf("_");
    return {
      sheet,
      row: Number(rest.slice(0, i)),
      col: Number(rest.slice(i + 1)),
    };
  }

  recalculate(row: number, col: number, sheetIndex?: string | number): void {
    const sheet = sheetIndex ?? this.workbook.activeIndex;
    const cell = this.workbook.getCell(row, col, sheet);
    if (!cell?.f) {
      this.clearDeps(this.key(sheet, row, col));
      return;
    }
    try {
      const ast = Parser.parse(cell.f);
      this.setDeps(sheet, row, col, collectRefs(ast));
      const value = this.evaluateAst(ast, sheet, new Set());
      this.writeResult(row, col, sheet, value, cell.f);
    } catch {
      this.writeResult(row, col, sheet, { error: "#ERROR!" }, cell.f);
    }
  }

  recalculateDependents(row: number, col: number, sheetIndex?: string | number): void {
    const sheet = sheetIndex ?? this.workbook.activeIndex;
    const k = this.key(sheet, row, col);
    const dependents = this.reverse.get(k);
    if (!dependents) return;
    const queue = [...dependents];
    const seen = new Set<DepKey>();
    while (queue.length) {
      const dk = queue.shift()!;
      if (seen.has(dk)) continue;
      seen.add(dk);
      const { sheet: s, row: r, col: c } = this.parseKey(dk);
      // sheet index may be number stored as string
      const sheetId = this.resolveSheetIndex(s);
      this.recalculate(r, c, sheetId);
      const next = this.reverse.get(dk);
      if (next) queue.push(...next);
    }
  }

  /** Recalc all formulas on a sheet (e.g. after load) */
  recalculateAll(sheetIndex?: string | number): void {
    const sheet = this.workbook.getSheetByIndex(
      sheetIndex ?? this.workbook.activeIndex,
    );
    if (!sheet) return;
    sheet.forEachCell((r, c, cell) => {
      if (cell.f) this.recalculate(r, c, sheet.index);
    });
  }

  private resolveSheetIndex(s: string): string | number {
    const n = Number(s);
    if (!Number.isNaN(n) && String(n) === s) {
      if (this.workbook.getSheetByIndex(n)) return n;
    }
    return s;
  }

  private clearDeps(formulaKey: DepKey): void {
    const old = this.deps.get(formulaKey);
    if (old) {
      for (const d of old) {
        this.reverse.get(d)?.delete(formulaKey);
      }
    }
    this.deps.delete(formulaKey);
  }

  private setDeps(
    sheet: string | number,
    row: number,
    col: number,
    refs: Array<{ row: number; col: number }>,
  ): void {
    const fk = this.key(sheet, row, col);
    this.clearDeps(fk);
    const set = new Set<DepKey>();
    for (const ref of refs) {
      const dk = this.key(sheet, ref.row, ref.col);
      set.add(dk);
      if (!this.reverse.has(dk)) this.reverse.set(dk, new Set());
      this.reverse.get(dk)!.add(fk);
    }
    this.deps.set(fk, set);
  }

  private writeResult(
    row: number,
    col: number,
    sheet: string | number,
    value: FormulaValue | FormulaError,
    formula: string,
  ): void {
    const prev = this.workbook.getCell(row, col, sheet);
    if (isError(value)) {
      this.workbook.setCell(
        row,
        col,
        {
          ...(prev ?? {}),
          f: formula,
          v: value.error,
          m: value.error,
          ct: { fa: "General", t: "e" },
        },
        sheet,
      );
      return;
    }
    const isNum = typeof value === "number";
    this.workbook.setCell(
      row,
      col,
      {
        ...(prev ?? {}),
        f: formula,
        v: value,
        m: value == null ? "" : String(value),
        ct: { fa: "General", t: isNum ? "n" : typeof value === "boolean" ? "b" : "g" },
      },
      sheet,
    );
  }

  evaluateAst(
    node: AstNode,
    sheetIndex: string | number,
    stack: Set<string>,
  ): FormulaValue | FormulaError {
    const ctx: EvalContext = { workbook: this.workbook, sheetIndex, stack };

    const evalNode = (
      n: AstNode,
    ): FormulaValue | FormulaError | FormulaValue[] => {
      switch (n.type) {
        case "number":
          return n.value;
        case "string":
          return n.value;
        case "bool":
          return n.value;
        case "ref": {
          const key = `${sheetIndex}:${n.row}_${n.col}`;
          if (stack.has(key)) return { error: "#CYCLE!" };
          const cell = this.workbook.getCell(n.row, n.col, sheetIndex);
          if (cell?.f) {
            stack.add(key);
            try {
              // Ensure formula cell is evaluated if stale
              if (cell.v == null && cell.m == null) {
                this.recalculate(n.row, n.col, sheetIndex);
              }
              const updated = this.workbook.getCell(n.row, n.col, sheetIndex);
              if (updated?.v != null) return updated.v as FormulaValue;
              // Evaluate nested formula AST directly
              try {
                const nested = Parser.parse(cell.f);
                return this.evaluateAst(nested, sheetIndex, stack);
              } catch {
                return { error: "#ERROR!" };
              }
            } finally {
              stack.delete(key);
            }
          }
          return getCellRaw(ctx, n.row, n.col);
        }
        case "range": {
          const values: FormulaValue[] = [];
          for (let r = n.r1; r <= n.r2; r++) {
            for (let c = n.c1; c <= n.c2; c++) {
              const v = getCellRaw(ctx, r, c);
              if (!isError(v)) values.push(v);
            }
          }
          return values;
        }
        case "unary": {
          const a = evalNode(n.arg);
          if (Array.isArray(a)) return { error: "#VALUE!" };
          if (isError(a)) return a;
          const num = toNumber(a);
          if (isError(num)) return num;
          return n.op === "-" ? -num : num;
        }
        case "binary": {
          const left = evalNode(n.left);
          const right = evalNode(n.right);
          if (Array.isArray(left) || Array.isArray(right)) return { error: "#VALUE!" };
          if (isError(left)) return left;
          if (isError(right)) return right;
          if (n.op === "&") {
            const ls = toString(left);
            const rs = toString(right);
            if (isError(ls)) return ls;
            if (isError(rs)) return rs;
            return ls + rs;
          }
          const ln = toNumber(left);
          const rn = toNumber(right);
          if (isError(ln)) return ln;
          if (isError(rn)) return rn;
          switch (n.op) {
            case "+":
              return ln + rn;
            case "-":
              return ln - rn;
            case "*":
              return ln * rn;
            case "/":
              return rn === 0 ? { error: "#DIV/0!" } : ln / rn;
            case "<":
              return ln < rn;
            case ">":
              return ln > rn;
            case "<=":
              return ln <= rn;
            case ">=":
              return ln >= rn;
            case "=":
              return left === right || ln === rn;
            case "<>":
              return left !== right && ln !== rn;
            default:
              return { error: "#ERROR!" };
          }
        }
        case "call": {
          const fn = builtins[n.name];
          if (!fn) return { error: "#NAME?" };
          return fn(n.args, evalNode, ctx);
        }
      }
    };

    const result = evalNode(node);
    return Array.isArray(result) ? result[0] ?? null : result;
  }
}
