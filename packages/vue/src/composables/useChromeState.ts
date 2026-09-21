import { onMounted, onUnmounted, shallowRef, type ShallowRef } from "vue";
import type {
  SelectionRange,
  WorkbookEngine,
} from "@luckysheet3/core";

export type ChromeState = {
  selection: ShallowRef<SelectionRange[]>;
  activeSheetIndex: ShallowRef<string | number>;
  sheets: ShallowRef<Array<{ name: string; index: string | number; status: number }>>;
  undoDepth: ShallowRef<number>;
  redoDepth: ShallowRef<number>;
  editing: ShallowRef<boolean>;
  formulaText: ShallowRef<string>;
  paintFormatActive: ShallowRef<boolean>;
};

/** Subscribe engine events into shallowRefs for chrome only — never reactive cells. */
export function useChromeState(engine: WorkbookEngine): ChromeState {
  const selection = shallowRef(engine.selection);
  const activeSheetIndex = shallowRef(engine.activeSheetIndex);
  const sheets = shallowRef(engine.sheets);
  const undoDepth = shallowRef(engine.undoDepth);
  const redoDepth = shallowRef(engine.redoDepth);
  const editing = shallowRef(engine.editing);
  const formulaText = shallowRef("");
  const paintFormatActive = shallowRef(engine.isPaintFormatActive());

  const syncFormula = () => {
    const sel = engine.selection[0];
    if (!sel) {
      formulaText.value = "";
      return;
    }
    const r = sel.row[0];
    const c = sel.column[0];
    const cell = engine.workbook.getCell(r, c);
    formulaText.value = cell?.f ?? (cell?.m != null ? String(cell.m) : cell?.v != null ? String(cell.v) : "");
  };

  let off: (() => void) | undefined;

  onMounted(() => {
    syncFormula();
    off = engine.on((e) => {
      if (e.type === "selection") selection.value = e.selection;
      if (e.type === "sheet") {
        activeSheetIndex.value = e.activeIndex;
        sheets.value = engine.sheets;
      }
      if (e.type === "history") {
        undoDepth.value = e.undoDepth;
        redoDepth.value = e.redoDepth;
      }
      if (e.type === "edit") editing.value = e.editing;
      if (e.type === "paintFormat") paintFormatActive.value = e.active;
      if (e.type === "change" || e.type === "selection") syncFormula();
    });
  });

  onUnmounted(() => off?.());

  return {
    selection,
    activeSheetIndex,
    sheets,
    undoDepth,
    redoDepth,
    editing,
    formulaText,
    paintFormatActive,
  };
}
