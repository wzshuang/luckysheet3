import type { Workbook } from "../model/workbook.js";
import { displayValue } from "../model/cell.js";
import type { CellBorder } from "../model/cell.js";
import {
  buildColOffsets,
  buildRowOffsets,
  colLeft,
  COL_HEADER_HEIGHT,
  contentSize,
  freezeBandSize,
  getCellRect,
  ROW_HEADER_WIDTH,
  rowTop,
  searchOffset,
} from "../hit/location.js";
import { colToLetter } from "../model/cell-key.js";

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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const scrollLeft = this.workbook.scrollLeft;
    const scrollTop = this.workbook.scrollTop;
    const freeze = sheet.config.freeze ?? { row: 0, col: 0 };
    const band = freezeBandSize(sheet, this.rowOffsets, this.colOffsets);

    const scrollStartCol = Math.max(
      freeze.col,
      searchOffset(this.colOffsets, scrollLeft + band.width),
    );
    const endCol = Math.min(
      sheet.colCount - 1,
      searchOffset(this.colOffsets, scrollLeft + w - ROW_HEADER_WIDTH) + 1,
    );
    const scrollStartRow = Math.max(
      freeze.row,
      searchOffset(this.rowOffsets, scrollTop + band.height),
    );
    const endRow = Math.min(
      sheet.rowCount - 1,
      searchOffset(this.rowOffsets, scrollTop + h - COL_HEADER_HEIGHT) + 1,
    );

    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, w, COL_HEADER_HEIGHT);
    ctx.strokeStyle = "#d4d4d4";
    ctx.beginPath();
    ctx.moveTo(0, COL_HEADER_HEIGHT - 0.5);
    ctx.lineTo(w, COL_HEADER_HEIGHT - 0.5);
    ctx.stroke();

    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const paintColHeader = (c: number, useScroll: boolean) => {
      const x =
        ROW_HEADER_WIDTH +
        colLeft(this.colOffsets, c) -
        (useScroll ? scrollLeft : 0);
      const width = sheet.getColWidth(c);
      if (x + width < ROW_HEADER_WIDTH || x > w) return;
      ctx.strokeStyle = "#d4d4d4";
      ctx.beginPath();
      ctx.moveTo(x + width - 0.5, 0);
      ctx.lineTo(x + width - 0.5, COL_HEADER_HEIGHT);
      ctx.stroke();
      ctx.fillStyle = "#5a5a5a";
      ctx.fillText(colToLetter(c), x + width / 2, COL_HEADER_HEIGHT / 2);
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      ROW_HEADER_WIDTH + band.width,
      0,
      Math.max(0, w - ROW_HEADER_WIDTH - band.width),
      COL_HEADER_HEIGHT,
    );
    ctx.clip();
    for (let c = scrollStartCol; c <= endCol; c++) paintColHeader(c, true);
    ctx.restore();

    for (let c = 0; c < freeze.col; c++) paintColHeader(c, false);

    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, h);

    const paintRowHeader = (r: number, useScroll: boolean) => {
      if (sheet.hiddenRows.has(r)) return;
      const y =
        COL_HEADER_HEIGHT +
        rowTop(this.rowOffsets, r) -
        (useScroll ? scrollTop : 0);
      const height = sheet.getRowHeight(r);
      if (height <= 0) return;
      if (y + height < COL_HEADER_HEIGHT || y > h) return;
      ctx.strokeStyle = "#d4d4d4";
      ctx.beginPath();
      ctx.moveTo(0, y + height - 0.5);
      ctx.lineTo(ROW_HEADER_WIDTH, y + height - 0.5);
      ctx.stroke();
      ctx.fillStyle = "#5a5a5a";
      ctx.textAlign = "center";
      ctx.fillText(String(r + 1), ROW_HEADER_WIDTH / 2, y + height / 2);
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      0,
      COL_HEADER_HEIGHT + band.height,
      ROW_HEADER_WIDTH,
      Math.max(0, h - COL_HEADER_HEIGHT - band.height),
    );
    ctx.clip();
    for (let r = scrollStartRow; r <= endRow; r++) paintRowHeader(r, true);
    ctx.restore();

    for (let r = 0; r < freeze.row; r++) paintRowHeader(r, false);

    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);

    const paintCell = (r: number, c: number) => {
      if (sheet.hiddenRows.has(r)) return;
      if (sheet.isMergeCovered(r, c)) return;
      const rect = getCellRect(
        sheet,
        r,
        c,
        this.rowOffsets,
        this.colOffsets,
        scrollLeft,
        scrollTop,
      );
      const cell = sheet.getCell(rect.row, rect.col);

      if (cell?.bg) {
        ctx.fillStyle = cell.bg;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }

      ctx.strokeStyle = "#e0e0e0";
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
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
      }
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      ROW_HEADER_WIDTH + band.width,
      COL_HEADER_HEIGHT + band.height,
      Math.max(0, w - ROW_HEADER_WIDTH - band.width),
      Math.max(0, h - COL_HEADER_HEIGHT - band.height),
    );
    ctx.clip();
    for (let r = scrollStartRow; r <= endRow; r++) {
      for (let c = scrollStartCol; c <= endCol; c++) paintCell(r, c);
    }
    ctx.restore();

    if (freeze.row > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        ROW_HEADER_WIDTH,
        COL_HEADER_HEIGHT,
        w - ROW_HEADER_WIDTH,
        band.height,
      );
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
      ctx.rect(
        ROW_HEADER_WIDTH,
        COL_HEADER_HEIGHT + band.height,
        band.width,
        Math.max(0, h - COL_HEADER_HEIGHT - band.height),
      );
      ctx.clip();
      for (let r = scrollStartRow; r <= endRow; r++) {
        for (let c = 0; c < freeze.col; c++) paintCell(r, c);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, w - ROW_HEADER_WIDTH, h - COL_HEADER_HEIGHT);
    ctx.clip();

    const sel = this.workbook.selection[0];
    if (sel) {
      const r0 = Math.min(sel.row[0], sel.row[1]);
      const r1 = Math.max(sel.row[0], sel.row[1]);
      const c0 = Math.min(sel.column[0], sel.column[1]);
      const c1 = Math.max(sel.column[0], sel.column[1]);
      const topLeft = getCellRect(
        sheet,
        r0,
        c0,
        this.rowOffsets,
        this.colOffsets,
        scrollLeft,
        scrollTop,
      );
      const bottomRight = getCellRect(
        sheet,
        r1,
        c1,
        this.rowOffsets,
        this.colOffsets,
        scrollLeft,
        scrollTop,
      );
      const sx = topLeft.x;
      const sy = topLeft.y;
      const sw = bottomRight.x + bottomRight.width - sx;
      const sh = bottomRight.y + bottomRight.height - sy;
      ctx.fillStyle = "rgba(1, 136, 251, 0.08)";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = "#0188fb";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.lineWidth = 1;
      const handleSize = 6;
      ctx.fillStyle = "#0188fb";
      ctx.fillRect(
        sx + sw - handleSize / 2,
        sy + sh - handleSize / 2,
        handleSize,
        handleSize,
      );
    }

    if (freeze.row > 0) {
      const y = COL_HEADER_HEIGHT + band.height;
      ctx.strokeStyle = "#0188fb";
      ctx.beginPath();
      ctx.moveTo(ROW_HEADER_WIDTH, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    if (freeze.col > 0) {
      const x = ROW_HEADER_WIDTH + band.width;
      ctx.strokeStyle = "#0188fb";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, COL_HEADER_HEIGHT);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }

    ctx.restore();
  }

  getContentSize(): { width: number; height: number } {
    return contentSize(this.rowOffsets, this.colOffsets);
  }
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
