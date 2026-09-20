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
  hitTest,
  type CellRect,
} from "./hit/location.js";
import { displayValue } from "./model/cell.js";

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

  hitTest(px: number, py: number): { row: number; col: number } | null {
    const sheet = this.workbook.getActiveSheet();
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
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

  getCellRect(row: number, col: number): CellRect {
    const sheet = this.workbook.getActiveSheet();
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
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
