/**
 * 从同级 LuckysheetDemo 重新生成 fixtures/lucky/sheet-cell.json
 * 用法（在仓库根目录）: node apps/playground/scripts/extract-cell-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const demoJs = path.resolve(here, "../../../LuckysheetDemo/demoData/sheetCell.js");
const outJson = path.resolve(here, "../../../fixtures/lucky/sheet-cell.json");

if (!fs.existsSync(demoJs)) {
  console.error("找不到:", demoJs);
  process.exit(1);
}

const ctx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(demoJs, "utf8"), ctx);
const sheet = ctx.window.sheetCell;

const out = {
  name: sheet.name,
  index: 0,
  order: 0,
  status: 1,
  row: sheet.row ?? 84,
  column: sheet.column ?? 60,
  config: sheet.config,
  celldata: sheet.celldata,
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
console.log("Wrote", outJson, "celldata:", out.celldata?.length);
