import type { CellData } from "../model/cell.js";
import type { LuckyOp, SelectionRange } from "../model/workbook.js";
import type { SheetStatePatch } from "../model/sheet.js";

export type Command =
  | {
      type: "setCellValue";
      row: number;
      col: number;
      value: string | number | boolean | null;
      formula?: string | null;
      sheetIndex?: string | number;
    }
  | {
      type: "setStyle";
      row: number;
      col: number;
      style: Partial<
        Pick<CellData, "bg" | "fc" | "bl" | "it" | "fs" | "ff" | "ht" | "vt">
      >;
      sheetIndex?: string | number;
    }
  | {
      type: "setSelection";
      selection: SelectionRange[];
    }
  | {
      type: "switchSheet";
      index: string | number;
    }
  | {
      type: "setScroll";
      scrollLeft: number;
      scrollTop: number;
    }
  | {
      type: "mergeCells";
      row: number;
      col: number;
      rowCount: number;
      colCount: number;
      sheetIndex?: string | number;
    }
  | {
      type: "unmergeCells";
      row: number;
      col: number;
      sheetIndex?: string | number;
    }
  | {
      type: "insertRows";
      index: number;
      count: number;
      sheetIndex?: string | number;
    }
  | {
      type: "deleteRows";
      index: number;
      count: number;
      sheetIndex?: string | number;
    }
  | {
      type: "insertCols";
      index: number;
      count: number;
      sheetIndex?: string | number;
    }
  | {
      type: "deleteCols";
      index: number;
      count: number;
      sheetIndex?: string | number;
    }
  | {
      type: "setRowHeight";
      row: number;
      height: number;
      sheetIndex?: string | number;
    }
  | {
      type: "setColWidth";
      col: number;
      width: number;
      sheetIndex?: string | number;
    }
  | {
      type: "pasteCells";
      anchorRow: number;
      anchorCol: number;
      cells: Array<Array<CellData | null>>;
      merges?: import("../clipboard/clipboard.js").RelativeMerge[];
      clearSource?: { row: number; col: number; rowCount: number; colCount: number };
      sheetIndex?: string | number;
    }
  | {
      type: "paintFormat";
      anchorRow: number;
      anchorCol: number;
      rowCount: number;
      colCount: number;
      source: Array<Array<CellData | null>>;
      sheetIndex?: string | number;
    }
  | {
      type: "fillCells";
      from: SelectionRange;
      to: SelectionRange;
      sheetIndex?: string | number;
    }
  | {
      type: "setFreeze";
      row: number;
      col: number;
      sheetIndex?: string | number;
    }
  | {
      type: "replaceAll";
      query: string;
      replacement: string;
      matchCase?: boolean;
      sheetIndex?: string | number;
    }
  | {
      type: "setFilter";
      col: number;
      selectedValues: string[] | null;
      sheetIndex?: string | number;
    }
  | {
      type: "setBorders";
      range: SelectionRange;
      mode: "all" | "outside" | "none";
      color?: string;
      style?: number;
      sheetIndex?: string | number;
    }
  | {
      type: "setFormat";
      row: number;
      col: number;
      preset: import("../format/number-format.js").FormatPresetId;
      sheetIndex?: string | number;
    }
  | {
      type: "clearFormat";
      row: number;
      col: number;
      sheetIndex?: string | number;
    }
  | {
      type: "addSheet";
      name?: string;
    }
  | {
      type: "deleteSheet";
      index: string | number;
    }
  | {
      type: "renameSheet";
      index: string | number;
      name: string;
    };

export type InverseEntry = {
  command: Command;
  prevCell?: CellData | null;
  prevSelection?: SelectionRange[];
  prevSheetIndex?: string | number;
  prevScroll?: { left: number; top: number };
  /** structural undo */
  prevState?: SheetStatePatch;
  prevHeight?: number;
  prevWidth?: number;
  prevFreeze?: { row: number; col: number };
  affectedCells?: Array<{ row: number; col: number; cell: CellData | null }>;
  /** workbook-level sheet list undo */
  prevSheets?: import("../model/sheet.js").SheetSnapshot[];
  prevActiveIndex?: string | number;
  prevName?: string;
};

export type ExecuteResult = {
  inverse: InverseEntry;
  op?: LuckyOp;
};
