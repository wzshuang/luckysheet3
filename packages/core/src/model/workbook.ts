import { Sheet, type SheetSnapshot } from "./sheet.js";
import { type Cell, type CellData, cloneCell } from "./cell.js";
import type { ClipboardPayload } from "../clipboard/clipboard.js";

export type SelectionRange = {
  row: [number, number];
  column: [number, number];
};

export type WorkbookListener = (event: WorkbookEvent) => void;

export type WorkbookEvent =
  | { type: "change"; sheetIndex: string | number }
  | { type: "selection"; selection: SelectionRange[] }
  | { type: "scroll"; scrollLeft: number; scrollTop: number }
  | { type: "sheet"; activeIndex: string | number }
  | { type: "history"; undoDepth: number; redoDepth: number }
  | { type: "op"; op: LuckyOp }
  | { type: "edit"; editing: boolean; row?: number; col?: number };

/** Luckysheet collaborative opcode (MVP: v | rv only) */
export type LuckyOp = {
  t: "v" | "rv";
  i: string | number;
  v: unknown;
  r?: number;
  c?: number;
  range?: { row: [number, number]; column: [number, number] };
};

import type { ClipboardPayload } from "../clipboard/clipboard.js";

export class Workbook {
  sheets: Sheet[] = [];
  activeIndex: string | number = 0;
  selection: SelectionRange[] = [{ row: [0, 0], column: [0, 0] }];
  scrollLeft = 0;
  scrollTop = 0;
  editing = false;
  editRow = 0;
  editCol = 0;
  clipboard: ClipboardPayload | null = null;
  private listeners = new Set<WorkbookListener>();

  constructor(sheets?: SheetSnapshot[]) {
    if (sheets?.length) {
      this.load(sheets);
    } else {
      const sheet = new Sheet({ name: "Sheet1", index: 0, order: 0, status: 1 });
      this.sheets = [sheet];
      this.activeIndex = 0;
    }
  }

  on(listener: WorkbookListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: WorkbookEvent): void {
    for (const l of this.listeners) l(event);
  }

  load(sheets: SheetSnapshot[]): void {
    this.sheets = sheets.map((s) => new Sheet(s));
    const active =
      this.sheets.find((s) => s.status === 1) ?? this.sheets[0];
    this.activeIndex = active.index;
    this.selection = [{ row: [0, 0], column: [0, 0] }];
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.emit({ type: "change", sheetIndex: this.activeIndex });
    this.emit({ type: "sheet", activeIndex: this.activeIndex });
  }

  getActiveSheet(): Sheet {
    const s =
      this.sheets.find((x) => x.index === this.activeIndex) ?? this.sheets[0];
    if (!s) throw new Error("No active sheet");
    return s;
  }

  getSheetByIndex(index: string | number): Sheet | undefined {
    return this.sheets.find((s) => s.index === index);
  }

  getCell(row: number, col: number, sheetIndex?: string | number): CellData | null {
    const sheet =
      sheetIndex == null
        ? this.getActiveSheet()
        : this.getSheetByIndex(sheetIndex);
    return sheet?.getCell(row, col) ?? null;
  }

  setCell(
    row: number,
    col: number,
    cell: Cell,
    sheetIndex?: string | number,
  ): void {
    const sheet =
      sheetIndex == null
        ? this.getActiveSheet()
        : this.getSheetByIndex(sheetIndex);
    if (!sheet) throw new Error(`Sheet not found: ${sheetIndex}`);
    sheet.setCell(row, col, cell);
    this.emit({ type: "change", sheetIndex: sheet.index });
  }

  setSelection(selection: SelectionRange[]): void {
    this.selection = selection.map((s) => ({
      row: [s.row[0], s.row[1]] as [number, number],
      column: [s.column[0], s.column[1]] as [number, number],
    }));
    this.emit({ type: "selection", selection: this.selection });
  }

  setScroll(left: number, top: number): void {
    this.scrollLeft = Math.max(0, left);
    this.scrollTop = Math.max(0, top);
    this.emit({
      type: "scroll",
      scrollLeft: this.scrollLeft,
      scrollTop: this.scrollTop,
    });
  }

  switchSheet(index: string | number): void {
    if (!this.getSheetByIndex(index)) throw new Error(`Sheet not found: ${index}`);
    for (const s of this.sheets) {
      s.status = s.index === index ? 1 : 0;
    }
    this.activeIndex = index;
    this.emit({ type: "sheet", activeIndex: index });
    this.emit({ type: "change", sheetIndex: index });
  }

  /** Next numeric-ish index */
  private nextSheetIndex(): number {
    let max = -1;
    for (const s of this.sheets) {
      const n = typeof s.index === "number" ? s.index : Number(s.index);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
    return max + 1;
  }

  addSheet(name?: string): string | number {
    const index = this.nextSheetIndex();
    const order =
      this.sheets.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const sheetName = name?.trim() || `Sheet${this.sheets.length + 1}`;
    const sheet = new Sheet({
      name: sheetName,
      index,
      order,
      status: 0,
    });
    this.sheets.push(sheet);
    this.switchSheet(index);
    return index;
  }

  renameSheet(index: string | number, name: string): void {
    const sheet = this.getSheetByIndex(index);
    if (!sheet) throw new Error(`Sheet not found: ${index}`);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Sheet name empty");
    sheet.name = trimmed;
    this.emit({ type: "sheet", activeIndex: this.activeIndex });
    this.emit({ type: "change", sheetIndex: index });
  }

  deleteSheet(index: string | number): void {
    if (this.sheets.length <= 1) {
      throw new Error("Cannot delete the last sheet");
    }
    const pos = this.sheets.findIndex((s) => s.index === index);
    if (pos < 0) throw new Error(`Sheet not found: ${index}`);
    const wasActive = this.activeIndex === index;
    this.sheets.splice(pos, 1);
    if (wasActive) {
      const next = this.sheets[Math.min(pos, this.sheets.length - 1)];
      this.switchSheet(next.index);
    } else {
      this.emit({ type: "sheet", activeIndex: this.activeIndex });
      this.emit({ type: "change", sheetIndex: this.activeIndex });
    }
  }

  /** Replace entire sheet list (for undo) */
  restoreSheets(snapshots: SheetSnapshot[], activeIndex: string | number): void {
    this.sheets = snapshots.map((s) => new Sheet(s));
    this.activeIndex = activeIndex;
    for (const s of this.sheets) {
      s.status = s.index === activeIndex ? 1 : 0;
    }
    this.emit({ type: "sheet", activeIndex });
    this.emit({ type: "change", sheetIndex: activeIndex });
  }

  setEditing(editing: boolean, row?: number, col?: number): void {
    this.editing = editing;
    if (row != null) this.editRow = row;
    if (col != null) this.editCol = col;
    this.emit({ type: "edit", editing, row: this.editRow, col: this.editCol });
  }

  toSnapshots(): SheetSnapshot[] {
    return this.sheets.map((s) => s.toSnapshot());
  }

  /** Patch cell fields, preserving others */
  patchCell(
    row: number,
    col: number,
    patch: Partial<CellData>,
    sheetIndex?: string | number,
  ): CellData | null {
    const prev = this.getCell(row, col, sheetIndex);
    const next: CellData = { ...(prev ?? {}), ...patch };
    if (patch.ct) next.ct = { ...(prev?.ct ?? {}), ...patch.ct };
    this.setCell(row, col, next, sheetIndex);
    return cloneCell(next);
  }
}
