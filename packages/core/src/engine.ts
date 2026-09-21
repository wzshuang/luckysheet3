import { Workbook, type LuckyOp, type PaintMode, type SelectionRange, type WorkbookListener } from "./model/workbook.js";
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
  hitColHeader,
  hitColResize,
  hitCorner as isCornerHit,
  hitRowHeader,
  hitRowResize,
  hitTest,
  type CellRect,
} from "./hit/location.js";
import { displayValue } from "./model/cell.js";
import { extractRange, extractMerges, type ClipboardPayload } from "./clipboard/clipboard.js";
import {
  cellsToHtml,
  cellsToTsv,
  parseClipboardPayload,
} from "./clipboard/serialize.js";
import { extractFormatMatrix } from "./clipboard/style.js";
import { collectColumnValues, findNext } from "./find/find-replace.js";
import {
  extendRange,
  expandRangeForMerges,
  getFocusCell,
  normalizeRange,
  rangesOverlap,
} from "./selection/range.js";

export class WorkbookEngine {
  readonly workbook: Workbook;
  readonly commands: CommandBus;
  private renderer: CanvasRenderer | null = null;
  private viewport = { width: 800, height: 600 };
  private raf = 0;
  private copyAnimRaf = 0;

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
    this.stopCopyAnim();
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

  private startCopyAnim(): void {
    this.stopCopyAnim();
    if (typeof requestAnimationFrame === "undefined") return;
    const tick = () => {
      if (!this.workbook.copyHighlight) {
        this.copyAnimRaf = 0;
        return;
      }
      this.requestPaint();
      this.copyAnimRaf = requestAnimationFrame(tick);
    };
    this.copyAnimRaf = requestAnimationFrame(tick);
  }

  private stopCopyAnim(): void {
    if (this.copyAnimRaf && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.copyAnimRaf);
    }
    this.copyAnimRaf = 0;
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

  hitCorner(px: number, py: number): boolean {
    return isCornerHit(px, py);
  }

  /** Select entire active sheet (corner-click / select-all) */
  selectAll(): void {
    const sheet = this.workbook.getActiveSheet();
    const lastRow = Math.max(0, sheet.rowCount - 1);
    const lastCol = Math.max(0, sheet.colCount - 1);
    this.execute({
      type: "setSelection",
      selection: [
        {
          row: [0, lastRow],
          column: [0, lastCol],
          row_focus: 0,
          column_focus: 0,
          row_select: true,
          column_select: true,
        },
      ],
    });
  }

  getActiveRange(): SelectionRange | null {
    const list = this.workbook.selection;
    if (!list.length) return null;
    return list[list.length - 1];
  }

  getFocusCell(): { row: number; col: number } | null {
    const sel = this.getActiveRange();
    if (!sel) return null;
    const focus = getFocusCell(sel);
    const sheet = this.workbook.getActiveSheet();
    const merge = sheet.getMergeAt(focus.row, focus.col);
    if (merge) return { row: merge.r, col: merge.c };
    return focus;
  }

  /**
   * Cell click / shift-extend / ctrl-append.
   * Active range is always the last item in selection[].
   */
  selectAt(
    row: number,
    col: number,
    opts?: { shift?: boolean; ctrl?: boolean },
  ): void {
    const sheet = this.workbook.getActiveSheet();
    const shift = !!opts?.shift;
    const ctrl = !!opts?.ctrl;
    const current = this.getActiveRange();

    if (shift && current) {
      const extended = extendRange(current, row, col, sheet);
      const rest = this.workbook.selection.slice(0, -1);
      this.execute({
        type: "setSelection",
        selection: [...rest, extended],
      });
      return;
    }

    const next = normalizeRange(
      {
        row: [row, row],
        column: [col, col],
        row_focus: row,
        column_focus: col,
      },
      sheet,
    );

    if (ctrl && this.workbook.selection.length > 0) {
      const overlaps = this.workbook.selection.some((s) =>
        rangesOverlap(s, next),
      );
      if (overlaps) {
        // Overlap with existing: replace all with single cell (Lucky-like simplification)
        this.execute({ type: "setSelection", selection: [next] });
      } else {
        this.execute({
          type: "setSelection",
          selection: [...this.workbook.selection, next],
        });
      }
      return;
    }

    this.execute({ type: "setSelection", selection: [next] });
  }

  selectRow(
    row: number,
    opts?: { shift?: boolean; endRow?: number },
  ): void {
    const sheet = this.workbook.getActiveSheet();
    const lastCol = Math.max(0, sheet.colCount - 1);
    const end = opts?.endRow ?? row;
    let r0 = Math.min(row, end);
    let r1 = Math.max(row, end);
    let focus = row;

    if (opts?.shift) {
      const cur = this.getActiveRange();
      if (cur) {
        focus = cur.row_focus ?? cur.row[0];
        r0 = Math.min(focus, end);
        r1 = Math.max(focus, end);
      }
    }

    this.execute({
      type: "setSelection",
      selection: [
        normalizeRange(
          {
            row: [r0, r1],
            column: [0, lastCol],
            row_focus: focus,
            column_focus: 0,
            row_select: true,
          },
          sheet,
        ),
      ],
    });
  }

  selectColumn(
    col: number,
    opts?: { shift?: boolean; endCol?: number },
  ): void {
    const sheet = this.workbook.getActiveSheet();
    const lastRow = Math.max(0, sheet.rowCount - 1);
    const end = opts?.endCol ?? col;
    let c0 = Math.min(col, end);
    let c1 = Math.max(col, end);
    let focus = col;

    if (opts?.shift) {
      const cur = this.getActiveRange();
      if (cur) {
        focus = cur.column_focus ?? cur.column[0];
        c0 = Math.min(focus, end);
        c1 = Math.max(focus, end);
      }
    }

    this.execute({
      type: "setSelection",
      selection: [
        normalizeRange(
          {
            row: [0, lastRow],
            column: [c0, c1],
            row_focus: 0,
            column_focus: focus,
            column_select: true,
          },
          sheet,
        ),
      ],
    });
  }

  hitRowResize(px: number, py: number): number | null {
    const { sheet, rowOffsets } = this.offsets();
    return hitRowResize(sheet, px, py, this.workbook.scrollTop, rowOffsets);
  }

  hitColResize(px: number, py: number): number | null {
    const { sheet, colOffsets } = this.offsets();
    return hitColResize(sheet, px, py, this.workbook.scrollLeft, colOffsets);
  }

  hitRowHeader(px: number, py: number): number | null {
    const { sheet, rowOffsets } = this.offsets();
    return hitRowHeader(
      sheet,
      px,
      py,
      this.workbook.scrollTop,
      rowOffsets,
    );
  }

  hitColHeader(px: number, py: number): number | null {
    const { sheet, colOffsets } = this.offsets();
    return hitColHeader(
      sheet,
      px,
      py,
      this.workbook.scrollLeft,
      colOffsets,
    );
  }

  getFillHandleAt(px: number, py: number): boolean {
    const sel = this.getActiveRange();
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
    const focus = this.getFocusCell();
    const r = row ?? focus?.row ?? 0;
    const c = col ?? focus?.col ?? 0;
    this.workbook.setEditing(true, r, c);
    this.workbook.editDraft = this.getEditText();
  }

  setEditDraft(text: string): void {
    this.workbook.editDraft = text;
  }

  commitEdit(text?: string): void {
    if (!this.workbook.editing) return;
    const r = this.workbook.editRow;
    const c = this.workbook.editCol;
    const value = text ?? this.workbook.editDraft;
    this.workbook.setEditing(false);
    if (value.startsWith("=")) {
      this.execute({ type: "setCellValue", row: r, col: c, value: null, formula: value });
    } else {
      this.execute({
        type: "setCellValue",
        row: r,
        col: c,
        value: value === "" ? null : value,
      });
    }
  }

  /**
   * End in-cell edit (commit draft) and select another cell — Excel/Lucky style
   * when clicking away from the editor.
   */
  commitEditAndSelect(row: number, col: number, text?: string): void {
    if (this.workbook.editing) {
      this.commitEdit(text);
    }
    this.selectAt(row, col);
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
    const sel = this.getActiveRange();
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
    const focus = this.getFocusCell();
    if (!focus) return;
    const cell = this.workbook.getCell(focus.row, focus.col);
    const next = cell?.[key] ? 0 : 1;
    this.applyStyleToSelection({ [key]: next });
  }

  applyFormatToSelection(preset: import("./format/number-format.js").FormatPresetId): void {
    const sel = this.getActiveRange();
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
    const sel = this.getActiveRange();
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
    const focus = this.getFocusCell();
    if (!focus) return null;
    return this.workbook.getCell(focus.row, focus.col);
  }

  mergeSelection(): void {
    const sel = this.getActiveRange();
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
    const sel = this.getActiveRange();
    if (!sel) return;
    this.execute({
      type: "unmergeCells",
      row: Math.min(sel.row[0], sel.row[1]),
      col: Math.min(sel.column[0], sel.column[1]),
    });
  }

  insertRowsAtSelection(count = 1): void {
    const sel = this.getActiveRange();
    if (!sel) return;
    this.execute({
      type: "insertRows",
      index: Math.min(sel.row[0], sel.row[1]),
      count,
    });
  }

  deleteRowsAtSelection(): void {
    const sel = this.getActiveRange();
    if (!sel) return;
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    this.execute({ type: "deleteRows", index: r0, count: r1 - r0 + 1 });
  }

  insertColsAtSelection(count = 1): void {
    const sel = this.getActiveRange();
    if (!sel) return;
    this.execute({
      type: "insertCols",
      index: Math.min(sel.column[0], sel.column[1]),
      count,
    });
  }

  deleteColsAtSelection(): void {
    const sel = this.getActiveRange();
    if (!sel) return;
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    this.execute({ type: "deleteCols", index: c0, count: c1 - c0 + 1 });
  }

  copySelection(): void {
    if (this.workbook.paintMode) this.cancelPaintFormat();
    const sel = this.getActiveRange();
    if (!sel) return;
    const sheet = this.workbook.getActiveSheet();
    const from = expandRangeForMerges(sel, sheet);
    this.workbook.clipboard = {
      cells: extractRange(sheet, from),
      from,
      cut: false,
      merges: extractMerges(sheet, from),
    };
    this.setCopyHighlight(from);
  }

  cutSelection(): void {
    if (this.workbook.paintMode) this.cancelPaintFormat();
    const sel = this.getActiveRange();
    if (!sel) return;
    const sheet = this.workbook.getActiveSheet();
    const from = expandRangeForMerges(sel, sheet);
    this.workbook.clipboard = {
      cells: extractRange(sheet, from),
      from,
      cut: true,
      merges: extractMerges(sheet, from),
    };
    this.setCopyHighlight(from);
  }

  /** TSV for `navigator.clipboard.writeText` / text/plain ClipboardItem. */
  getClipboardTsv(): string | null {
    const clip = this.workbook.clipboard;
    if (!clip) return null;
    return cellsToTsv(clip.cells);
  }

  /** HTML table for text/html ClipboardItem (Excel / Sheets). */
  getClipboardHtml(): string | null {
    const clip = this.workbook.clipboard;
    if (!clip) return null;
    return cellsToHtml(clip.cells, clip.merges);
  }

  setCopyHighlight(range: SelectionRange | null): void {
    this.workbook.copyHighlight = range;
    this.workbook.emit({
      type: "change",
      sheetIndex: this.workbook.activeIndex,
    });
    this.requestPaint();
    if (range) this.startCopyAnim();
    else this.stopCopyAnim();
  }

  clearCopyHighlight(): void {
    if (!this.workbook.copyHighlight) return;
    this.setCopyHighlight(null);
  }

  isPaintFormatActive(): boolean {
    return this.workbook.paintMode != null;
  }

  startPaintFormat(single: boolean): boolean {
    if (this.workbook.selection.length !== 1) return false;
    const sel = this.getActiveRange();
    if (!sel) return false;
    const sheet = this.workbook.getActiveSheet();
    const source = extractFormatMatrix(extractRange(sheet, sel));
    this.workbook.paintMode = { single, source, from: sel };
    this.setCopyHighlight(sel);
    this.workbook.emit({ type: "paintFormat", active: true });
    return true;
  }

  cancelPaintFormat(): void {
    const hadPaint = this.workbook.paintMode != null;
    if (!hadPaint && !this.workbook.copyHighlight) return;
    this.workbook.paintMode = null;
    this.setCopyHighlight(null);
    if (hadPaint) {
      this.workbook.emit({ type: "paintFormat", active: false });
    }
  }

  applyPaintFormatToSelection(): boolean {
    const mode = this.workbook.paintMode;
    const sel = this.getActiveRange();
    if (!mode || !sel) return false;
    const r0 = Math.min(sel.row[0], sel.row[1]);
    const r1 = Math.max(sel.row[0], sel.row[1]);
    const c0 = Math.min(sel.column[0], sel.column[1]);
    const c1 = Math.max(sel.column[0], sel.column[1]);
    let rowCount = r1 - r0 + 1;
    let colCount = c1 - c0 + 1;
    const srcH = mode.source.length;
    const srcW = mode.source[0]?.length ?? 0;
    if (rowCount === 1 && colCount === 1 && srcH > 0 && srcW > 0) {
      rowCount = srcH;
      colCount = srcW;
    }
    this.execute({
      type: "paintFormat",
      anchorRow: r0,
      anchorCol: c0,
      rowCount,
      colCount,
      source: mode.source,
    });
    if (mode.single) this.cancelPaintFormat();
    return true;
  }

  pasteAtSelection(): void {
    const clip = this.workbook.clipboard;
    const sel = this.getActiveRange();
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
      merges: clip.merges,
      clearSource,
    });
    if (clip.cut) {
      this.workbook.clipboard = null;
      this.clearCopyHighlight();
    }
  }

  /**
   * Paste from system clipboard (TSV / HTML table) when there is no
   * in-memory payload, or when the caller explicitly wants external data.
   */
  pasteFromExternal(input: { html?: string; text?: string }): boolean {
    const parsed = parseClipboardPayload(input);
    const sel = this.getActiveRange();
    if (!parsed || !sel) return false;
    this.execute({
      type: "pasteCells",
      anchorRow: Math.min(sel.row[0], sel.row[1]),
      anchorCol: Math.min(sel.column[0], sel.column[1]),
      cells: parsed.cells,
      merges: parsed.merges,
    });
    return true;
  }

  fillTo(to: SelectionRange): void {
    const from = this.getActiveRange();
    if (!from) return;
    this.execute({ type: "fillCells", from, to });
    this.execute({ type: "setSelection", selection: [to] });
  }

  setFreeze(row: number, col: number): void {
    this.execute({ type: "setFreeze", row, col });
  }

  freezeSelection(): void {
    const sel = this.getActiveRange();
    if (!sel) return;
    this.setFreeze(
      Math.min(sel.row[0], sel.row[1]),
      Math.min(sel.column[0], sel.column[1]),
    );
  }

  findNext(query: string, matchCase = false): { row: number; col: number } | null {
    const sel = this.getActiveRange();
    const hit = findNext(this.workbook, query, {
      matchCase,
      afterRow: sel ? Math.min(sel.row[0], sel.row[1]) : 0,
      afterCol: sel ? Math.min(sel.column[0], sel.column[1]) : -1,
    });
    if (hit) {
      this.selectAt(hit.row, hit.col);
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
    const sel = this.getActiveRange();
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

export type { LuckyOp, SelectionRange, PaintMode, Command, CellData, SheetSnapshot, LuckySheetRaw };
export type { ClipboardPayload };
