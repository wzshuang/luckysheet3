import type { Workbook } from "../model/workbook.js";
import { displayValue } from "../model/cell.js";
import type { CellBorder } from "../model/cell.js";
import {
  buildColOffsets,
  buildRowOffsets,
  COL_HEADER_HEIGHT,
  contentSize,
  freezeBandSize,
  getCellRect,
  ROW_HEADER_WIDTH,
  searchOffset,
  type CellRect,
} from "../hit/location.js";
import { visibleCellRange } from "../layout/visible-range.js";
import { GRID_THEME } from "./grid-theme.js";

function textDecorationLineYs(
  ty: number,
  baseline: CanvasTextBaseline,
  fsPx: number,
): { underline: number; strike: number } {
  if (baseline === "top") {
    return { underline: ty + fsPx * 0.9, strike: ty + fsPx * 0.45 };
  }
  if (baseline === "bottom") {
    return { underline: ty - fsPx * 0.05, strike: ty - fsPx * 0.45 };
  }
  return { underline: ty + fsPx * 0.3, strike: ty - fsPx * 0.15 };
}

function paintTextDecorations(
  ctx: CanvasRenderingContext2D,
  text: string,
  tx: number,
  ty: number,
  fs: number,
  cell: { fc?: string | null; un?: number; cl?: number } | null | undefined,
): void {
  if (!cell?.un && !cell?.cl) return;
  const fsPx = fs * (96 / 72);
  const width = ctx.measureText(text).width;
  let x0 = tx;
  if (ctx.textAlign === "center") x0 = tx - width / 2;
  else if (ctx.textAlign === "right") x0 = tx - width;

  const { underline, strike } = textDecorationLineYs(ty, ctx.textBaseline, fsPx);
  ctx.save();
  ctx.strokeStyle = cell.fc ?? "#000000";
  ctx.lineWidth = Math.max(1, fsPx / 12);
  ctx.beginPath();
  if (cell.un) {
    ctx.moveTo(x0, underline);
    ctx.lineTo(x0 + width, underline);
  }
  if (cell.cl) {
    ctx.moveTo(x0, strike);
    ctx.lineTo(x0 + width, strike);
  }
  ctx.stroke();
  ctx.restore();
}

export type RenderViewport = {
  width: number;
  height: number;
};

export class CanvasRenderer {
  private dpr = 1;
  private rowOffsets: number[] = [];
  private colOffsets: number[] = [];

  constructor(
    private workbook: Workbook,
    private canvas: HTMLCanvasElement,
  ) {
    this.dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  }

  getOffsets(): { rowOffsets: number[]; colOffsets: number[] } {
    return { rowOffsets: this.rowOffsets, colOffsets: this.colOffsets };
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.floor(cssWidth * this.dpr);
    this.canvas.height = Math.floor(cssHeight * this.dpr);
  }

  paint(viewport: RenderViewport): void {
    const sheet = this.workbook.getActiveSheet();
    this.rowOffsets = buildRowOffsets(sheet);
    this.colOffsets = buildColOffsets(sheet);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const w = viewport.width;
    const h = viewport.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = GRID_THEME.canvasBackground;
    ctx.fillRect(0, 0, w, h);

    const scrollLeft = this.workbook.scrollLeft;
    const scrollTop = this.workbook.scrollTop;
    const freeze = sheet.config.freeze ?? { row: 0, col: 0 };
    const band = freezeBandSize(sheet, this.rowOffsets, this.colOffsets);

    const gx = ROW_HEADER_WIDTH;
    const gy = COL_HEADER_HEIGHT;

    const toSurface = (rect: CellRect): CellRect => ({
      ...rect,
      x: rect.x - gx,
      y: rect.y - gy,
    });

    let scrollStartCol: number;
    let endCol: number;
    let scrollStartRow: number;
    let endRow: number;
    if (freeze.row === 0 && freeze.col === 0) {
      const range = visibleCellRange(
        sheet,
        viewport,
        scrollLeft,
        scrollTop,
        this.rowOffsets,
        this.colOffsets,
      );
      scrollStartCol = range.scrollStartCol;
      endCol = range.endCol;
      scrollStartRow = range.scrollStartRow;
      endRow = range.endRow;
    } else {
      scrollStartCol = Math.max(
        freeze.col,
        searchOffset(this.colOffsets, scrollLeft + band.width),
      );
      endCol = Math.min(
        sheet.colCount - 1,
        searchOffset(this.colOffsets, scrollLeft + w) + 1,
      );
      scrollStartRow = Math.max(
        freeze.row,
        searchOffset(this.rowOffsets, scrollTop + band.height),
      );
      endRow = Math.min(
        sheet.rowCount - 1,
        searchOffset(this.rowOffsets, scrollTop + h) + 1,
      );
    }

    const paintCell = (r: number, c: number) => {
      if (sheet.hiddenRows.has(r)) return;
      if (sheet.isMergeCovered(r, c)) return;
      const gridRect = getCellRect(
        sheet,
        r,
        c,
        this.rowOffsets,
        this.colOffsets,
        scrollLeft,
        scrollTop,
      );
      const rect = toSurface(gridRect);
      const cell = sheet.getCell(gridRect.row, gridRect.col);

      if (cell?.bg) {
        ctx.fillStyle = cell.bg;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }

      paintDefaultCellGridLines(ctx, rect);
      paintCellBorders(ctx, rect, cell?.bd ?? null);

      const text = displayValue(cell);
      if (text) {
        const fs = cell?.fs ?? 10;
        const bold = cell?.bl ? "bold " : "";
        const italic = cell?.it ? "italic " : "";
        ctx.font = `${italic}${bold}${fs}pt sans-serif`;
        ctx.fillStyle = cell?.fc ?? "#000000";
        const ht = cell?.ht ?? 1;
        const vt = cell?.vt ?? 0;
        let tx = rect.x + 3;
        if (ht === 0) {
          ctx.textAlign = "center";
          tx = rect.x + rect.width / 2;
        } else if (ht === 2) {
          ctx.textAlign = "right";
          tx = rect.x + rect.width - 3;
        } else {
          ctx.textAlign = "left";
        }
        let ty = rect.y + rect.height / 2;
        if (vt === 1) {
          ctx.textBaseline = "top";
          ty = rect.y + 2;
        } else if (vt === 2) {
          ctx.textBaseline = "bottom";
          ty = rect.y + rect.height - 2;
        } else {
          ctx.textBaseline = "middle";
        }
        ctx.fillText(text, tx, ty);
        paintTextDecorations(ctx, text, tx, ty, fs, cell);
      }
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      band.width,
      band.height,
      Math.max(0, w - band.width),
      Math.max(0, h - band.height),
    );
    ctx.clip();
    for (let r = scrollStartRow; r <= endRow; r++) {
      for (let c = scrollStartCol; c <= endCol; c++) paintCell(r, c);
    }
    ctx.restore();

    if (freeze.row > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, band.height);
      ctx.clip();
      for (let r = 0; r < freeze.row; r++) {
        for (let c = scrollStartCol; c <= endCol; c++) paintCell(r, c);
        for (let c = 0; c < freeze.col; c++) paintCell(r, c);
      }
      ctx.restore();
    }

    if (freeze.col > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, band.height, band.width, Math.max(0, h - band.height));
      ctx.clip();
      for (let r = scrollStartRow; r <= endRow; r++) {
        for (let c = 0; c < freeze.col; c++) paintCell(r, c);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    const selections = this.workbook.selection;
    const lastIdx = selections.length - 1;
    for (let i = 0; i < selections.length; i++) {
      const sel = selections[i];
      const r0 = Math.min(sel.row[0], sel.row[1]);
      const r1 = Math.max(sel.row[0], sel.row[1]);
      const c0 = Math.min(sel.column[0], sel.column[1]);
      const c1 = Math.max(sel.column[0], sel.column[1]);
      const topLeft = toSurface(
        getCellRect(
          sheet,
          r0,
          c0,
          this.rowOffsets,
          this.colOffsets,
          scrollLeft,
          scrollTop,
        ),
      );
      const bottomRight = toSurface(
        getCellRect(
          sheet,
          r1,
          c1,
          this.rowOffsets,
          this.colOffsets,
          scrollLeft,
          scrollTop,
        ),
      );
      const sx = topLeft.x;
      const sy = topLeft.y;
      const sw = bottomRight.x + bottomRight.width - sx;
      const sh = bottomRight.y + bottomRight.height - sy;
      const isActive = i === lastIdx;

      ctx.fillStyle = isActive
        ? GRID_THEME.selectionFillActive
        : GRID_THEME.selectionFillInactive;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = isActive
        ? GRID_THEME.selectionBorder
        : GRID_THEME.selectionBorderInactive;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

      if (isActive) {
        ctx.strokeStyle = GRID_THEME.fillHandleBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);

        const handleSize = 6;
        const hx = sx + sw - handleSize + 2;
        const hy = sy + sh - handleSize + 2;
        ctx.fillStyle = GRID_THEME.fillHandleFill;
        ctx.fillRect(hx, hy, handleSize, handleSize);
        ctx.strokeStyle = GRID_THEME.fillHandleBorder;
        ctx.strokeRect(hx + 0.5, hy + 0.5, handleSize - 1, handleSize - 1);
      }
    }

    const copy = this.workbook.copyHighlight;
    if (copy) {
      const r0 = Math.min(copy.row[0], copy.row[1]);
      const r1 = Math.max(copy.row[0], copy.row[1]);
      const c0 = Math.min(copy.column[0], copy.column[1]);
      const c1 = Math.max(copy.column[0], copy.column[1]);
      const topLeft = toSurface(
        getCellRect(
          sheet,
          r0,
          c0,
          this.rowOffsets,
          this.colOffsets,
          scrollLeft,
          scrollTop,
        ),
      );
      const bottomRight = toSurface(
        getCellRect(
          sheet,
          r1,
          c1,
          this.rowOffsets,
          this.colOffsets,
          scrollLeft,
          scrollTop,
        ),
      );
      const sx = topLeft.x;
      const sy = topLeft.y;
      const sw = bottomRight.x + bottomRight.width - sx;
      const sh = bottomRight.y + bottomRight.height - sy;
      ctx.save();
      ctx.strokeStyle = GRID_THEME.selectionBorder;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -((Date.now() / 40) % 7);
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      ctx.restore();
    }

    if (freeze.row > 0) {
      const y = band.height;
      ctx.strokeStyle = GRID_THEME.selectionBorder;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    if (freeze.col > 0) {
      const x = band.width;
      ctx.strokeStyle = GRID_THEME.selectionBorder;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }

    ctx.restore();
  }

  getContentSize(): { width: number; height: number } {
    return contentSize(this.rowOffsets, this.colOffsets);
  }
}

/** Luckysheet draws only right + bottom per cell (strokeStyle #dfdfdf) to avoid double lines */
function paintDefaultCellGridLines(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  ctx.strokeStyle = GRID_THEME.cellGridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1 - 0.5, y0);
  ctx.lineTo(x1 - 0.5, y1);
  ctx.moveTo(x0, y1 - 0.5);
  ctx.lineTo(x1, y1 - 0.5);
  ctx.stroke();
}

function paintCellBorders(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  bd: CellBorder | null,
): void {
  if (!bd) return;
  const draw = (
    side: NonNullable<CellBorder[keyof CellBorder]> | undefined,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    if (!side) return;
    ctx.strokeStyle = side.color || "#000000";
    ctx.lineWidth = side.style >= 2 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  const x0 = rect.x + 0.5;
  const y0 = rect.y + 0.5;
  const x1 = rect.x + rect.width - 0.5;
  const y1 = rect.y + rect.height - 0.5;
  draw(bd.t, x0, y0, x1, y0);
  draw(bd.b, x0, y1, x1, y1);
  draw(bd.l, x0, y0, x0, y1);
  draw(bd.r, x1, y0, x1, y1);
}
