import type { LuckySheetRaw } from "@luckysheet3/core";
import sheetCellRaw from "../../../../fixtures/lucky/sheet-cell.json";

/**
 * 原版 LuckysheetDemo `demoData/sheetCell.js` 导出为 JSON，供对比页直接 load。
 * 仅去掉引擎不认识的字段；不伪造 borderInfo / 跨表公式等未支持能力。
 */
export function cellSheetForCompare(): LuckySheetRaw[] {
  const sheet = structuredClone(sheetCellRaw) as LuckySheetRaw;
  for (const item of sheet.celldata ?? []) {
    const v = item.v as Record<string, unknown> | null | undefined;
    if (v && typeof v === "object" && "customKey" in v) {
      delete v.customKey;
    }
  }
  return [sheet];
}

/** 对比时右侧预期无法 1:1 还原的能力（便于肉眼找差距） */
export const CELL_SHEET_KNOWN_GAPS = [
  "config.borderInfo 单元格/区域边框（当前仅支持手动 bd / 工具栏边框）",
  "跨工作表引用（如 =Formula!D3+Formula!D4，未加载 Formula 页）",
  "条件格式、数据验证、批注、图片等 sheet 扩展字段",
  "部分边框线型 style 9/10 等与原版像素级差异",
] as const;
