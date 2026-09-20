import type { CellData } from "../model/cell.js";
import type { LuckyOp, SelectionRange } from "../model/workbook.js";

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
    };

export type InverseEntry = {
  command: Command;
  /** previous cell snapshot for setCellValue/setStyle */
  prevCell?: CellData | null;
  prevSelection?: SelectionRange[];
  prevSheetIndex?: string | number;
  prevScroll?: { left: number; top: number };
};

export type ExecuteResult = {
  inverse: InverseEntry;
  op?: LuckyOp;
};
