import { Workbook, type LuckyOp, type SelectionRange, type WorkbookListener } from "./model/workbook.js";
import type { SheetSnapshot } from "./model/sheet.js";
import type { CellData } from "./model/cell.js";
import { CommandBus } from "./command/bus.js";
import type { Command } from "./command/types.js";
import { fromLuckyFile, toLuckyFile, type LuckySheetRaw } from "./io/lucky-json.js";
import { CanvasRenderer } from "./render/canvas-renderer.js";
import {
  buildColOffsets,
  buildRowOffsets,
  getCellRect,
  getFillHandleRect,
  hitColResize,
  hitRowResize,
  hitTest,
  type CellRect,
} from "./hit/location.js";
import { displayValue } from "./model/cell.js";
import { extractRange, type ClipboardPayload } from "./clipboard/clipboard.js";
import { collectColumnValues, findNext } from "./find/find-replace.js";

export class WorkbookEngine {
  readonly workbook: Workbook;
  readonly commands: CommandBus;
  private renderer: CanvasRenderer | null = null;
  private viewport = { width: 800, height: 600 };
  private raf = 0;

  constructor(data?: LuckySheetRaw[] | SheetSnapshot[]) {
    this.workbook = new Workbook();
    this.commands = new CommandBus(this.workbook);
    if (data) this.load(data);
  }

  load(data: LuckySheetRaw[] | SheetSnapshot[]): void {
    const snapshots = isSheetSnapshots(data) ? data : fromLuckyFile(data);
    this.workbook.load(snapshots);
    this.commands.formula.recalculateAll();
    this.requestPaint();
  }

  toLuckyFile(): LuckySheetRaw[] {
    return toLuckyFile(this.workbook.toSnapshots());
  }

  on(listener: WorkbookListener): () => void {
    return this.workbook.on((e) => {
      listener(e);
      if (e.type === "change" || e.type === "selection" || e.type === "scroll" || e.type === "sheet") {
        this.requestPaint();
      }
    });
  }

  execute(command: Command) {
    const result = this.commands.execute(command);
    this.requestPaint();
    return result;
  }

  undo(): boolean {
    const ok = this.commands.undo();
    this.requestPaint();
    return ok;
  }

  redo(): boolean {
    const ok = this.commands.redo();
    this.requestPaint();
    return ok;
  }

  getCellValue(row: number, col: number, type: "v" | "m" | "f" = "v"): unknown {
    const cell = this.workbook.getCell(row, col);
    if (!cell) return null;
    if (type === "m") return displayValue(cell);
    if (type === "f") return cell.f ?? null;
    return cell.v ?? null;
  }

  setCellValue(row: number, col: number, value: string | number | boolean | null): void {
    const str = value == null ? null : String(value);
    if (str != null && str.startsWith("=")) {
      this.execute({ type: "setCellValue", row, col, value: null, formula: str });
    } else {
      this.execute({ type: "setCellValue", row, col, value });
    }
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.renderer = new CanvasRenderer(this.workbook, canvas);
    this.requestPaint();
  }

  detachCanvas(): void {
    this.renderer = null;
  }

  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
    this.renderer?.resize(width, height);
    this.requestPaint();
  }

  paint(): void {
    if (!this.renderer) return;
    this.renderer.resize(this.viewport.width, this.viewport.height);
    this.renderer.paint(this.viewport);
  }

  requestPaint(): void {
    if (typeof requestAnimationFrame === "undefined") {
      this.paint();
      return;
    }
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.paint();
    });
  }

  private offsets() {
    const sheet = this.workbook.getActiveSheet();
    return {
      sheet,
      rowOffsets: buildRowOffsets(sheet),
      colOffsets: buildColOffsets(sheet),
    };
  }

  hitTest(px: number, py: number): { row: number; col: number } | null {
    const { sheet, rowOffsets, colOffsets } = this.offsets();
    return hitTest(
      sheet,
      px,
      py,
      this.workbook.scrollLeft,
      this.workbook.scrollTop,
      rowOffsets,
      colOffsets,
    );
  }

  hitRowResize(px: number, py: number): number | null {
    const { sheet, rowOffsets } = this.offsets();
    return hitRowResize(sheet, px, py, this.workbook.scrollTop, rowOffsets);
  }

  hitColResize(px: number, py: number): number | null {
    const { sheet, colOffsets } = this.offsets();
    return hitColResize(sheet, px, py, this.workbook.scrollLeft, colOffsets);
  }

  getFillHandleAt(px: number, py: number): boolean {
    const sel = this.workbook.selection[0];
    if (!sel) return false;
    const { sheet, rowOffsets, colOffsets } = this.offsets();
    const h = getFillHandleRect(
      sheet,
      sel,
      rowOffsets,
      colOffsets,
      this.workbook.scrollLeft,
      this.workbook.scrollTop,
    );
    return px >= h.x && px <= h.x + h.size && py >= h.y && py <= h.y + h.size;
  }

  getCellRect(row: number, col: number): CellRect {
    const { sheet, rowOffsets, colOffsets } = this.offsets();
    return getCellRect(
      sheet,
      row,
      col,
      rowOffsets,
      colOffsets,
      this.workbook.scrollLeft,
      this.workbook.scrollTop,
    );
  }

  get selection(): SelectionRange[] {
    return this.workbook.selection;
  }

  get activeSheetIndex(): string | number {
    return this.workbook.activeIndex;
  }

  get sheets() {
    return this.workbook.sheets.map((s) => ({
      name: s.name,
      index: s.index,
      order: s.order,
      status: s.status,
    }));
  }

  get undoDepth(): number {
    return this.commands.undoDepth;
  }

  get redoDepth(): number {
    return this.commands.redoDepth;
  }

  get editing(): boolean {
    return this.workbook.editing;
  }

  startEdit(row?: number, col?: number): void {
    const sel = this.workbook.selection[0];
    const r = row ?? sel?.row[0] ?? 0;
    const c = col ?? sel?.column[0] ?? 0;
    this.workbook.setEditing(true, r, c);
  }

  commitEdit(text: string): void {
    const r = this.workbook.editRow;
    const c = this.workbook.editCol;
    this.workbook.setEditing(false);
    if (text.startsWith("=")) {
      this.execute({ type: "setCellValue", row: r, col: c, value: null, formula: text });
    } else {
      this.execute({
        type: "setCellValue",
        row: r,
        col: c,
        value: text === "" ? null : text,
      });
    }
  }

  cancelEdit(): void {
    this.workbook.setEditing(false);
  }

  getEditText(): string {
    const cell = this.workbook.getCell(this.workbook.editRow, this.workbook.editCol);
    if (!cell) return "";
    if (cell.f) return cell.f;
    return displayValue(cell);
  }

  applyStyleToSelection(
    style: Partial<Pick<CellData, "bg" | "fc" | "bl" | "it" | "fs" | "ff" | "ht" | "vt">>,
  ): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.execute({ type: "setStyle", row: r, col: c, style });
      }
    }
  }

  /** Toggle bold / italic on selection using first cell as reference */
  toggleStyleOnSelection(key: "bl" | "it"): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    const cell = this.workbook.getCell(
      Math.min(sel.row[0], sel.row[1]),
      Math.min(sel.column[0], sel.column[1]),
    );
    const next = cell?.[key] ? 0 : 1;
    this.applyStyleToSelection({ [key]: next });
  }

  applyFormatToSelection(preset: import("./format/number-format.js").FormatPresetId): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.execute({ type: "setFormat", row: r, col: c, preset });
      }
    }
  }

  clearFormatOnSelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.execute({ type: "clearFormat", row: r, col: c });
      }
    }
  }

  getActiveCellStyle(): Partial<CellData> | null {
    const sel = this.workbook.selection[0];
    if (!sel) return null;
    return this.workbook.getCell(
      Math.min(sel.row[0], sel.row[1]),
      Math.min(sel.column[0], sel.column[1]),
    );
  }

  mergeSelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    if (r0 === r1 && c0 === c1) return;
    this.execute({
      type: "mergeCells",
      row: r0,
      col: c0,
      rowCount: r1 - r0 + 1,
      colCount: c1 - c0 + 1,
    });
  }

  unmergeSelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    this.execute({
      type: "unmergeCells",
      row: Math.min(sel.row[0], sel.row[1]),
      col: Math.min(sel.column[0], sel.column[1]),
    });
  }

  insertRowsAtSelection(count = 1): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    this.execute({
      type: "insertRows",
      index: Math.min(sel.row[0], sel.row[1]),
      count,
    });
  }

  deleteRowsAtSelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    this.execute({ type: "deleteRows", index: r0, count: r1 - r0 + 1 });
  }

  insertColsAtSelection(count = 1): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    this.execute({
      type: "insertCols",
      index: Math.min(sel.column[0], sel.column[1]),
      count,
    });
  }

  deleteColsAtSelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    this.execute({ type: "deleteCols", index: c0, count: c1 - c0 + 1 });
  }

  copySelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    this.workbook.clipboard = {
      cells: extractRange(this.workbook.getActiveSheet(), sel),
      from: sel,
      cut: false,
    };
  }

  cutSelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    this.workbook.clipboard = {
      cells: extractRange(this.workbook.getActiveSheet(), sel),
      from: sel,
      cut: true,
    };
  }

  pasteAtSelection(): void {
    const clip = this.workbook.clipboard;
    const sel = this.workbook.selection[0];
    if (!clip || !sel) return;
    const clearSource = clip.cut
      ? {
          row: Math.min(clip.from.row[0], clip.from.row[1]),
          col: Math.min(clip.from.column[0], clip.from.column[1]),
          rowCount: clip.cells.length,
          colCount: clip.cells[0]?.length ?? 0,
        }
      : undefined;
    this.execute({
      type: "pasteCells",
      anchorRow: Math.min(sel.row[0], sel.row[1]),
      anchorCol: Math.min(sel.column[0], sel.column[1]),
      cells: clip.cells,
      clearSource,
    });
    if (clip.cut) this.workbook.clipboard = null;
  }

  fillTo(to: SelectionRange): void {
    const from = this.workbook.selection[0];
    if (!from) return;
    this.execute({ type: "fillCells", from, to });
    this.execute({ type: "setSelection", selection: [to] });
  }

  setFreeze(row: number, col: number): void {
    this.execute({ type: "setFreeze", row, col });
  }

  freezeSelection(): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    this.setFreeze(
      Math.min(sel.row[0], sel.row[1]),
      Math.min(sel.column[0], sel.column[1]),
    );
  }

  findNext(query: string, matchCase = false): { row: number; col: number } | null {
    const sel = this.workbook.selection[0];
    const hit = findNext(this.workbook, query, {
      matchCase,
      afterRow: sel ? Math.min(sel.row[0], sel.row[1]) : 0,
      afterCol: sel ? Math.min(sel.column[0], sel.column[1]) : -1,
    });
    if (hit) {
      this.execute({
        type: "setSelection",
        selection: [{ row: [hit.row, hit.row], column: [hit.col, hit.col] }],
      });
    }
    return hit;
  }

  replaceAll(query: string, replacement: string, matchCase = false): void {
    this.execute({ type: "replaceAll", query, replacement, matchCase });
  }

  setColumnFilter(col: number, selectedValues: string[] | null): void {
    this.execute({ type: "setFilter", col, selectedValues });
  }

  getColumnFilterValues(col: number): string[] {
    return collectColumnValues(this.workbook, col);
  }

  applyBordersToSelection(
    mode: "all" | "outside" | "none",
    color = "#000000",
    style = 1,
  ): void {
    const sel = this.workbook.selection[0];
    if (!sel) return;
    this.execute({ type: "setBorders", range: sel, mode, color, style });
  }

  addSheet(name?: string): void {
    this.execute({ type: "addSheet", name });
  }

  deleteSheet(index?: string | number): void {
    this.execute({
      type: "deleteSheet",
      index: index ?? this.workbook.activeIndex,
    });
  }

  renameSheet(index: string | number, name: string): void {
    this.execute({ type: "renameSheet", index, name });
  }

  destroy(): void {
    this.detachCanvas();
    if (this.raf && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.raf);
    }
  }
}

function isSheetSnapshots(
  data: LuckySheetRaw[] | SheetSnapshot[],
): data is SheetSnapshot[] {
  if (!data.length) return true;
  const first = data[0] as SheetSnapshot & LuckySheetRaw;
  return Array.isArray(first.celldata) && !("data" in first && first.data && !first.celldata);
}

export type { LuckyOp, SelectionRange, Command, CellData, SheetSnapshot, LuckySheetRaw };
export type { ClipboardPayload };
