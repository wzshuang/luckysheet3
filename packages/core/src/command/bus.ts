import type { Workbook } from "../model/workbook.js";
import type { CellData } from "../model/cell.js";
import { cloneCell } from "../model/cell.js";
import type { Command, ExecuteResult, InverseEntry } from "./types.js";
import { FormulaEngine } from "../formula/evaluator.js";

const DEFAULT_HISTORY = 100;

export class CommandBus {
  private undoStack: InverseEntry[] = [];
  private redoStack: InverseEntry[] = [];
  private applyingHistory = false;
  formula: FormulaEngine;

  constructor(
    private workbook: Workbook,
    private historyLimit = DEFAULT_HISTORY,
  ) {
    this.formula = new FormulaEngine(workbook);
  }

  execute(command: Command, opts?: { record?: boolean }): ExecuteResult {
    const record = opts?.record !== false;
    const result = this.apply(command);
    if (record && !this.applyingHistory && command.type !== "setSelection" && command.type !== "setScroll") {
      this.undoStack.push(result.inverse);
      if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
      this.redoStack = [];
      this.emitHistory();
    }
    if (result.op) {
      this.workbook.emit({ type: "op", op: result.op });
    }
    return result;
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.applyingHistory = true;
    try {
      const redoInverse = this.applyInverse(entry);
      this.redoStack.push(redoInverse);
      this.emitHistory();
    } finally {
      this.applyingHistory = false;
    }
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.applyingHistory = true;
    try {
      const undoInverse = this.applyInverse(entry);
      this.undoStack.push(undoInverse);
      this.emitHistory();
    } finally {
      this.applyingHistory = false;
    }
    return true;
  }

  get undoDepth(): number {
    return this.undoStack.length;
  }

  get redoDepth(): number {
    return this.redoStack.length;
  }

  private emitHistory(): void {
    this.workbook.emit({
      type: "history",
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length,
    });
  }

  private applyInverse(entry: InverseEntry): InverseEntry {
    const { command, prevCell, prevSelection, prevSheetIndex, prevScroll } = entry;
    if (command.type === "setCellValue" || command.type === "setStyle") {
      const sheetIndex = command.sheetIndex ?? this.workbook.activeIndex;
      const current = cloneCell(
        this.workbook.getCell(command.row, command.col, sheetIndex),
      );
      this.workbook.setCell(command.row, command.col, prevCell ?? null, sheetIndex);
      if (command.type === "setCellValue") {
        this.formula.recalculate(command.row, command.col, sheetIndex);
      }
      return {
        command,
        prevCell: current,
      };
    }
    if (command.type === "setSelection" && prevSelection) {
      const cur = this.workbook.selection;
      this.workbook.setSelection(prevSelection);
      return { command, prevSelection: cur };
    }
    if (command.type === "switchSheet" && prevSheetIndex != null) {
      const cur = this.workbook.activeIndex;
      this.workbook.switchSheet(prevSheetIndex);
      return { command, prevSheetIndex: cur };
    }
    if (command.type === "setScroll" && prevScroll) {
      const cur = { left: this.workbook.scrollLeft, top: this.workbook.scrollTop };
      this.workbook.setScroll(prevScroll.left, prevScroll.top);
      return { command, prevScroll: cur };
    }
    return entry;
  }

  private apply(command: Command): ExecuteResult {
    switch (command.type) {
      case "setCellValue":
        return this.applySetCellValue(command);
      case "setStyle":
        return this.applySetStyle(command);
      case "setSelection": {
        const prevSelection = this.workbook.selection;
        this.workbook.setSelection(command.selection);
        return { inverse: { command, prevSelection } };
      }
      case "switchSheet": {
        const prevSheetIndex = this.workbook.activeIndex;
        this.workbook.switchSheet(command.index);
        return { inverse: { command, prevSheetIndex } };
      }
      case "setScroll": {
        const prevScroll = {
          left: this.workbook.scrollLeft,
          top: this.workbook.scrollTop,
        };
        this.workbook.setScroll(command.scrollLeft, command.scrollTop);
        return { inverse: { command, prevScroll } };
      }
    }
  }

  private applySetCellValue(
    command: Extract<Command, { type: "setCellValue" }>,
  ): ExecuteResult {
    const sheetIndex = command.sheetIndex ?? this.workbook.activeIndex;
    const sheet = this.workbook.getSheetByIndex(sheetIndex)!;
    const prevCell = cloneCell(sheet.getCell(command.row, command.col));
    let next: CellData;

    if (command.formula) {
      const f = command.formula.startsWith("=")
        ? command.formula
        : `=${command.formula}`;
      next = {
        ...(prevCell ?? {}),
        f,
        v: null,
        m: null,
      };
      sheet.setCell(command.row, command.col, next);
      this.formula.recalculate(command.row, command.col, sheetIndex);
      next = sheet.getCell(command.row, command.col) ?? next;
    } else {
      const raw = command.value;
      const isNum =
        typeof raw === "number" ||
        (typeof raw === "string" && raw !== "" && !Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw.trim()));
      next = {
        ...(prevCell ?? {}),
        f: null,
        v: isNum && typeof raw === "string" ? Number(raw) : raw,
        m: raw == null ? "" : String(raw),
        ct: {
          fa: "General",
          t: isNum ? "n" : typeof raw === "boolean" ? "b" : "g",
        },
      };
      sheet.setCell(command.row, command.col, next);
      this.workbook.emit({ type: "change", sheetIndex });
      this.formula.recalculateDependents(command.row, command.col, sheetIndex);
    }

    const cellAfter = sheet.getCell(command.row, command.col);
    return {
      inverse: { command, prevCell },
      op: {
        t: "v",
        i: sheetIndex,
        r: command.row,
        c: command.col,
        v: cellAfter,
      },
    };
  }

  private applySetStyle(
    command: Extract<Command, { type: "setStyle" }>,
  ): ExecuteResult {
    const sheetIndex = command.sheetIndex ?? this.workbook.activeIndex;
    const prevCell = cloneCell(
      this.workbook.getCell(command.row, command.col, sheetIndex),
    );
    this.workbook.patchCell(command.row, command.col, command.style, sheetIndex);
    const cellAfter = this.workbook.getCell(command.row, command.col, sheetIndex);
    return {
      inverse: { command, prevCell },
      op: {
        t: "v",
        i: sheetIndex,
        r: command.row,
        c: command.col,
        v: cellAfter,
      },
    };
  }
}
