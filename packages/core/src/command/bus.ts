import type { Workbook } from "../model/workbook.js";
import type { CellData } from "../model/cell.js";
import { cloneCell } from "../model/cell.js";
import type { Command, ExecuteResult, InverseEntry } from "./types.js";
import { FormulaEngine } from "../formula/evaluator.js";
import { displayValue } from "../model/cell.js";
import { fillRange } from "../clipboard/clipboard.js";
import { applyBorders } from "../border/borders.js";
import {
  applyFormatToCell,
  clearCellFormat,
  presetById,
} from "../format/number-format.js";

const DEFAULT_HISTORY = 100;

const STRUCTURAL = new Set([
  "mergeCells",
  "unmergeCells",
  "insertRows",
  "deleteRows",
  "insertCols",
  "deleteCols",
  "pasteCells",
  "fillCells",
  "replaceAll",
  "setFilter",
  "setBorders",
]);

const SHEET_MGMT = new Set(["addSheet", "deleteSheet", "renameSheet"]);

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
    if (
      record &&
      !this.applyingHistory &&
      command.type !== "setSelection" &&
      command.type !== "setScroll"
    ) {
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

  private sheetOf(sheetIndex?: string | number) {
    const idx = sheetIndex ?? this.workbook.activeIndex;
    const sheet = this.workbook.getSheetByIndex(idx);
    if (!sheet) throw new Error(`Sheet not found: ${idx}`);
    return { sheet, sheetIndex: idx };
  }

  private applyInverse(entry: InverseEntry): InverseEntry {
    const { command } = entry;

    if (entry.prevSheets && SHEET_MGMT.has(command.type)) {
      const current = this.workbook.toSnapshots();
      const curActive = this.workbook.activeIndex;
      this.workbook.restoreSheets(entry.prevSheets, entry.prevActiveIndex ?? curActive);
      this.formula.recalculateAll();
      return {
        command,
        prevSheets: current,
        prevActiveIndex: curActive,
      };
    }

    if (entry.prevState && STRUCTURAL.has(command.type)) {
      const { sheet, sheetIndex } = this.sheetOf(
        "sheetIndex" in command ? command.sheetIndex : undefined,
      );
      const current = sheet.captureState();
      sheet.restoreState(entry.prevState);
      this.workbook.emit({ type: "change", sheetIndex });
      this.formula.recalculateAll(sheetIndex);
      return { command, prevState: current };
    }

    if (command.type === "setCellValue" || command.type === "setStyle" || command.type === "setFormat" || command.type === "clearFormat") {
      const sheetIndex = command.sheetIndex ?? this.workbook.activeIndex;
      const current = cloneCell(
        this.workbook.getCell(command.row, command.col, sheetIndex),
      );
      this.workbook.setCell(command.row, command.col, entry.prevCell ?? null, sheetIndex);
      if (command.type === "setCellValue") {
        this.formula.recalculate(command.row, command.col, sheetIndex);
      }
      return { command, prevCell: current };
    }
    if (command.type === "setSelection" && entry.prevSelection) {
      const cur = this.workbook.selection;
      this.workbook.setSelection(entry.prevSelection);
      return { command, prevSelection: cur };
    }
    if (command.type === "switchSheet" && entry.prevSheetIndex != null) {
      const cur = this.workbook.activeIndex;
      this.workbook.switchSheet(entry.prevSheetIndex);
      return { command, prevSheetIndex: cur };
    }
    if (command.type === "setScroll" && entry.prevScroll) {
      const cur = { left: this.workbook.scrollLeft, top: this.workbook.scrollTop };
      this.workbook.setScroll(entry.prevScroll.left, entry.prevScroll.top);
      return { command, prevScroll: cur };
    }
    if (command.type === "setRowHeight" && entry.prevHeight != null) {
      const { sheet, sheetIndex } = this.sheetOf(command.sheetIndex);
      const cur = sheet.getRowHeight(command.row);
      sheet.setRowHeight(command.row, entry.prevHeight);
      this.workbook.emit({ type: "change", sheetIndex });
      return { command, prevHeight: cur };
    }
    if (command.type === "setColWidth" && entry.prevWidth != null) {
      const { sheet, sheetIndex } = this.sheetOf(command.sheetIndex);
      const cur = sheet.getColWidth(command.col);
      sheet.setColWidth(command.col, entry.prevWidth);
      this.workbook.emit({ type: "change", sheetIndex });
      return { command, prevWidth: cur };
    }
    if (command.type === "setFreeze" && entry.prevFreeze) {
      const { sheet, sheetIndex } = this.sheetOf(command.sheetIndex);
      const cur = sheet.config.freeze ?? { row: 0, col: 0 };
      sheet.config.freeze = { ...entry.prevFreeze };
      this.workbook.emit({ type: "change", sheetIndex });
      return { command, prevFreeze: cur };
    }
    return entry;
  }

  private apply(command: Command): ExecuteResult {
    switch (command.type) {
      case "setCellValue":
        return this.applySetCellValue(command);
      case "setStyle":
        return this.applySetStyle(command);
      case "setFormat":
        return this.applySetFormat(command);
      case "clearFormat":
        return this.applyClearFormat(command);
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
      case "mergeCells":
        return this.applyStructural(command, (sheet) => {
          sheet.setMerge({
            r: command.row,
            c: command.col,
            rs: command.rowCount,
            cs: command.colCount,
          });
        });
      case "unmergeCells":
        return this.applyStructural(command, (sheet) => {
          sheet.removeMergeAt(command.row, command.col);
        });
      case "insertRows":
        return this.applyStructural(command, (sheet) => {
          sheet.insertRows(command.index, command.count);
        }, true);
      case "deleteRows":
        return this.applyStructural(command, (sheet) => {
          sheet.deleteRows(command.index, command.count);
        }, true);
      case "insertCols":
        return this.applyStructural(command, (sheet) => {
          sheet.insertCols(command.index, command.count);
        }, true);
      case "deleteCols":
        return this.applyStructural(command, (sheet) => {
          sheet.deleteCols(command.index, command.count);
        }, true);
      case "setRowHeight": {
        const { sheet, sheetIndex } = this.sheetOf(command.sheetIndex);
        const prevHeight = sheet.getRowHeight(command.row);
        sheet.setRowHeight(command.row, command.height);
        this.workbook.emit({ type: "change", sheetIndex });
        return { inverse: { command, prevHeight } };
      }
      case "setColWidth": {
        const { sheet, sheetIndex } = this.sheetOf(command.sheetIndex);
        const prevWidth = sheet.getColWidth(command.col);
        sheet.setColWidth(command.col, command.width);
        this.workbook.emit({ type: "change", sheetIndex });
        return { inverse: { command, prevWidth } };
      }
      case "pasteCells":
        return this.applyStructural(command, (sheet) => {
          const { cells, anchorRow, anchorCol, clearSource } = command;
          if (clearSource) {
            for (let r = 0; r < clearSource.rowCount; r++) {
              for (let c = 0; c < clearSource.colCount; c++) {
                sheet.setCell(clearSource.row + r, clearSource.col + c, null);
              }
            }
          }
          for (let r = 0; r < cells.length; r++) {
            for (let c = 0; c < (cells[r]?.length ?? 0); c++) {
              sheet.setCell(anchorRow + r, anchorCol + c, cells[r][c]);
            }
          }
        }, true);
      case "fillCells":
        return this.applyStructural(command, (sheet) => {
          fillRange(sheet, command.from, command.to);
        }, true);
      case "setFreeze": {
        const { sheet, sheetIndex } = this.sheetOf(command.sheetIndex);
        const prevFreeze = sheet.config.freeze ?? { row: 0, col: 0 };
        sheet.config.freeze = { row: command.row, col: command.col };
        this.workbook.emit({ type: "change", sheetIndex });
        return { inverse: { command, prevFreeze } };
      }
      case "replaceAll":
        return this.applyStructural(command, (sheet) => {
          const q = command.matchCase ? command.query : command.query.toLowerCase();
          sheet.forEachCell((r, c, cell) => {
            const text = displayValue(cell);
            const hay = command.matchCase ? text : text.toLowerCase();
            if (!hay.includes(q)) return;
            const flags = command.matchCase ? "g" : "gi";
            const next = text.replace(new RegExp(escapeRegExp(command.query), flags), command.replacement);
            sheet.setCell(r, c, {
              ...cell,
              f: null,
              v: next,
              m: next,
              ct: { fa: "General", t: "g" },
            });
          });
        }, true);
      case "setFilter":
        return this.applyStructural(command, (sheet) => {
          if (command.selectedValues == null) {
            sheet.hiddenRows.clear();
            return;
          }
          const allow = new Set(command.selectedValues);
          sheet.hiddenRows.clear();
          for (let r = 0; r < sheet.rowCount; r++) {
            const cell = sheet.getCell(r, command.col);
            const text = displayValue(cell);
            if (!allow.has(text)) sheet.hiddenRows.add(r);
          }
        });
      case "setBorders":
        return this.applyStructural(command, (sheet) => {
          applyBorders(
            sheet,
            command.range,
            command.mode,
            command.color ?? "#000000",
            command.style ?? 1,
          );
        });
      case "addSheet": {
        const prevSheets = this.workbook.toSnapshots();
        const prevActiveIndex = this.workbook.activeIndex;
        this.workbook.addSheet(command.name);
        this.formula.recalculateAll(this.workbook.activeIndex);
        return { inverse: { command, prevSheets, prevActiveIndex } };
      }
      case "deleteSheet": {
        const prevSheets = this.workbook.toSnapshots();
        const prevActiveIndex = this.workbook.activeIndex;
        this.workbook.deleteSheet(command.index);
        this.formula.recalculateAll(this.workbook.activeIndex);
        return { inverse: { command, prevSheets, prevActiveIndex } };
      }
      case "renameSheet": {
        const prevSheets = this.workbook.toSnapshots();
        const prevActiveIndex = this.workbook.activeIndex;
        this.workbook.renameSheet(command.index, command.name);
        return { inverse: { command, prevSheets, prevActiveIndex } };
      }
      default: {
        const _exhaustive: never = command;
        throw new Error(`Unknown command: ${(_exhaustive as Command).type}`);
      }
    }
  }

  private applyStructural(
    command: Command,
    mutator: (sheet: ReturnType<CommandBus["sheetOf"]>["sheet"]) => void,
    recalc = false,
  ): ExecuteResult {
    const sheetIndex =
      "sheetIndex" in command ? command.sheetIndex : undefined;
    const { sheet, sheetIndex: idx } = this.sheetOf(sheetIndex);
    const prevState = sheet.captureState();
    mutator(sheet);
    this.workbook.emit({ type: "change", sheetIndex: idx });
    if (recalc) this.formula.recalculateAll(idx);
    return { inverse: { command, prevState } };
  }

  private applySetCellValue(
    command: Extract<Command, { type: "setCellValue" }>,
  ): ExecuteResult {
    const sheetIndex = command.sheetIndex ?? this.workbook.activeIndex;
    const sheet = this.workbook.getSheetByIndex(sheetIndex)!;
    const prevCell = cloneCell(sheet.getCell(command.row, command.col));

    if (command.formula) {
      const f = command.formula.startsWith("=")
        ? command.formula
        : `=${command.formula}`;
      sheet.setCell(command.row, command.col, {
        ...(prevCell ?? {}),
        f,
        v: null,
        m: null,
      });
      this.formula.recalculate(command.row, command.col, sheetIndex);
    } else {
      const raw = command.value;
      const isNum =
        typeof raw === "number" ||
        (typeof raw === "string" &&
          raw !== "" &&
          !Number.isNaN(Number(raw)) &&
          /^-?\d+(\.\d+)?$/.test(raw.trim()));
      sheet.setCell(command.row, command.col, {
        ...(prevCell ?? {}),
        f: null,
        v: isNum && typeof raw === "string" ? Number(raw) : raw,
        m: raw == null ? "" : String(raw),
        ct: {
          fa: "General",
          t: isNum ? "n" : typeof raw === "boolean" ? "b" : "g",
        },
      });
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

  private applySetFormat(
    command: Extract<Command, { type: "setFormat" }>,
  ): ExecuteResult {
    const sheetIndex = command.sheetIndex ?? this.workbook.activeIndex;
    const prevCell = cloneCell(
      this.workbook.getCell(command.row, command.col, sheetIndex),
    );
    const next = applyFormatToCell(prevCell, presetById(command.preset));
    this.workbook.setCell(command.row, command.col, next, sheetIndex);
    return {
      inverse: { command, prevCell },
      op: {
        t: "v",
        i: sheetIndex,
        r: command.row,
        c: command.col,
        v: next,
      },
    };
  }

  private applyClearFormat(
    command: Extract<Command, { type: "clearFormat" }>,
  ): ExecuteResult {
    const sheetIndex = command.sheetIndex ?? this.workbook.activeIndex;
    const prevCell = cloneCell(
      this.workbook.getCell(command.row, command.col, sheetIndex),
    );
    const next = clearCellFormat(prevCell);
    this.workbook.setCell(command.row, command.col, next, sheetIndex);
    return {
      inverse: { command, prevCell },
      op: {
        t: "v",
        i: sheetIndex,
        r: command.row,
        c: command.col,
        v: next,
      },
    };
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
