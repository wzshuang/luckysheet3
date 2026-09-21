# 富粘贴与格式刷（D2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现格式刷（单击一次 / 双击连续）与富粘贴（HTML 样式/边框 + 合并格还原），对齐设计文档 D2。

**Architecture:** 扩展现有 `ClipboardPayload` / `pasteCells`；新增 `clipboard/style.ts` 与 `paintFormat` 命令；格式刷用 `workbook.paintMode` + 复制虚线；HTML 解析增强返回 `{ cells, merges }`。

**Tech Stack:** TypeScript、Vitest、Vue 3（Toolbar / GridCanvas）、现有 CommandBus。

**Spec:** `docs/superpowers/specs/2026-09-21-rich-paste-paint-format-design.md`

## Global Constraints

- 格式刷不创建/修改合并格；合并只走粘贴路径
- 多选区禁止启动格式刷
- 不做保护校验、粘贴选项对话框、图片、数据验证
- 单测在 `packages/core`：`npx vitest run`
- 提交信息用中文 `feat:` 前缀（与仓库风格一致）；每任务结束后由执行者按用户规则决定是否 commit（本计划写 commit 步骤，若用户未要求提交则跳过）

## File Map

| 文件 | 职责 |
|---|---|
| `packages/core/src/clipboard/style.ts` | `CellFormat`、`stripValue`、`applyFormat`、`extractFormatMatrix` |
| `packages/core/src/clipboard/clipboard.ts` | `RelativeMerge`、`extractMerges`、扩展 `ClipboardPayload` |
| `packages/core/src/clipboard/serialize.ts` | 富 HTML 解析/写出 + merges |
| `packages/core/src/command/types.ts` | `paintFormat`；`pasteCells.merges` |
| `packages/core/src/command/bus.ts` | 执行上述命令 |
| `packages/core/src/model/workbook.ts` | `PaintMode`、`paintMode` |
| `packages/core/src/engine.ts` | paint API、copy 带 merges、paste 带 merges |
| `packages/core/src/index.ts` | 导出新符号 |
| `packages/vue/src/components/Toolbar.vue` | 格式刷按钮 |
| `packages/vue/src/components/GridCanvas.vue` | paint pointerup / Esc / CSS |
| `packages/core/tests/paint-format.spec.ts` | 格式刷测试 |
| `packages/core/tests/clipboard.spec.ts` | 合并 + 富 HTML 测试 |
| `docs/FEATURE_MAP.md` | 状态更新 |

---

### Task 1: 样式工具函数 `clipboard/style.ts`

**Files:**
- Create: `packages/core/src/clipboard/style.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/paint-format.spec.ts`（本任务先写 style 相关用例）

**Interfaces:**
- Produces:
  - `export type CellFormat = Pick<CellData, "bg" | "fc" | "bl" | "it" | "fs" | "ff" | "ht" | "vt" | "bd" | "ct">`
  - `export function stripValue(cell: CellData | null): CellData | null`
  - `export function applyFormat(target: CellData | null, format: CellData | null): CellData | null`
  - `export function extractFormatMatrix(cells: Array<Array<CellData | null>>): Array<Array<CellData | null>>`

- [ ] **Step 1: 写失败测试**

在 `packages/core/tests/paint-format.spec.ts`：

```ts
import { describe, expect, it } from "vitest";
import { applyFormat, stripValue } from "../src/clipboard/style.js";

describe("clipboard style helpers", () => {
  it("stripValue removes v/m/f keeps format", () => {
    const out = stripValue({
      v: 1,
      m: "1",
      f: "=A1",
      bg: "#ff0",
      bl: 1,
      ct: { fa: "0.00", t: "n" },
    });
    expect(out?.v).toBeUndefined();
    expect(out?.m).toBeUndefined();
    expect(out?.f).toBeUndefined();
    expect(out?.bg).toBe("#ff0");
    expect(out?.bl).toBe(1);
    expect(out?.ct?.fa).toBe("0.00");
  });

  it("applyFormat keeps target value, overlays source format keys", () => {
    const next = applyFormat(
      { v: "keep", m: "keep", bg: "#111", fc: "#222" },
      { bg: "#ff0", bl: 1 },
    );
    expect(next?.v).toBe("keep");
    expect(next?.m).toBe("keep");
    expect(next?.bg).toBe("#ff0");
    expect(next?.bl).toBe(1);
    expect(next?.fc).toBe("#222"); // source undefined → leave
  });

  it("applyFormat with null source clears format but keeps value", () => {
    const next = applyFormat({ v: "x", m: "x", bg: "#ff0", bl: 1 }, null);
    expect(next?.v).toBe("x");
    expect(next?.bg).toBeUndefined();
    expect(next?.bl).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run tests/paint-format.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `style.ts`**

```ts
import type { CellData } from "../model/cell.js";
import { cloneCell } from "../model/cell.js";

export type CellFormat = Pick<
  CellData,
  "bg" | "fc" | "bl" | "it" | "fs" | "ff" | "ht" | "vt" | "bd" | "ct"
>;

const FORMAT_KEYS = [
  "bg",
  "fc",
  "bl",
  "it",
  "fs",
  "ff",
  "ht",
  "vt",
  "bd",
  "ct",
] as const;

export function stripValue(cell: CellData | null): CellData | null {
  if (!cell) return null;
  const cloned = cloneCell(cell)!;
  delete cloned.v;
  delete cloned.m;
  delete cloned.f;
  return cloned;
}

export function applyFormat(
  target: CellData | null,
  format: CellData | null,
): CellData | null {
  const base: CellData = target ? { ...cloneCell(target)! } : {};
  if (format == null) {
    for (const k of FORMAT_KEYS) delete (base as Record<string, unknown>)[k];
    if (base.v == null && base.m == null && base.f == null && Object.keys(base).length === 0) {
      return null;
    }
    return base;
  }
  const src = cloneCell(format)!;
  for (const k of FORMAT_KEYS) {
    if (src[k] !== undefined) {
      (base as Record<string, unknown>)[k] = src[k];
    }
  }
  return base;
}

export function extractFormatMatrix(
  cells: Array<Array<CellData | null>>,
): Array<Array<CellData | null>> {
  return cells.map((row) => row.map(stripValue));
}
```

从 `index.ts` 导出上述符号。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run tests/paint-format.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**（若用户要求提交）

```bash
git add packages/core/src/clipboard/style.ts packages/core/src/index.ts packages/core/tests/paint-format.spec.ts
git commit -m "feat: 新增剪贴板样式抽取与应用工具"
```

---

### Task 2: `paintFormat` 命令

**Files:**
- Modify: `packages/core/src/command/types.ts`
- Modify: `packages/core/src/command/bus.ts`
- Test: `packages/core/tests/paint-format.spec.ts`

**Interfaces:**
- Consumes: `applyFormat` from Task 1
- Produces: Command variant

```ts
{
  type: "paintFormat";
  anchorRow: number;
  anchorCol: number;
  rowCount: number;
  colCount: number;
  source: Array<Array<CellData | null>>;
  sheetIndex?: string | number;
}
```

- [ ] **Step 1: 写失败测试（经 engine.execute）**

```ts
import { WorkbookEngine } from "../src/engine.js";

describe("paintFormat command", () => {
  it("tiles format onto target and preserves values", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "src" });
    eng.execute({ type: "setStyle", row: 0, col: 0, style: { bg: "#ff0", bl: 1 } });
    eng.execute({ type: "setCellValue", row: 2, col: 2, value: "dst" });
    eng.execute({
      type: "paintFormat",
      anchorRow: 2,
      anchorCol: 2,
      rowCount: 1,
      colCount: 1,
      source: [[{ bg: "#ff0", bl: 1 }]],
    });
    const cell = eng.workbook.getCell(2, 2);
    expect(cell?.v).toBe("dst");
    expect(cell?.bg).toBe("#ff0");
    expect(cell?.bl).toBe(1);
  });

  it("undo restores previous cells", () => {
    const eng = new WorkbookEngine();
    eng.execute({ type: "setCellValue", row: 0, col: 0, value: "a" });
    eng.execute({
      type: "paintFormat",
      anchorRow: 0,
      anchorCol: 0,
      rowCount: 1,
      colCount: 1,
      source: [[{ bg: "#abc" }]],
    });
    eng.undo();
    expect(eng.workbook.getCell(0, 0)?.bg).toBeUndefined();
    expect(eng.workbook.getCell(0, 0)?.v).toBe("a");
  });
});
```

注：`setStyle` 若尚不支持 `bd`/`ct` 可只测 `bg`/`bl`；`paintFormat` 本身应支持完整 FORMAT_KEYS。

- [ ] **Step 2: 跑测试确认失败**

Expected: FAIL（未知 command 或未处理）

- [ ] **Step 3: 实现命令**

在 `types.ts` 的 `Command` 联合中加入 `paintFormat`。

在 `bus.ts`：
- 将 `"paintFormat"` 加入结构化命令列表（与 `pasteCells` 同类，走 `applyStructural`）
- case 实现：对 `r in [0,rowCount)` / `c in [0,colCount)`，取 `source[r % srcH][c % srcW]`，`sheet.setCell(anchorRow+r, anchorCol+c, applyFormat(sheet.getCell(...), src))`
- `applyStructural(..., true)` 以支持 undo 快照（与 pasteCells 一致）

若 `setStyle` 的 Pick 不含 `bd`/`ct`，**不要改 setStyle 范围除非必要**；paintFormat 直接写整格即可。

- [ ] **Step 4: 跑测试通过**

- [ ] **Step 5: Commit**（若用户要求）

```bash
git commit -m "feat: 新增 paintFormat 命令"
```

---

### Task 3: Engine 格式刷状态 + Vue 交互

**Files:**
- Modify: `packages/core/src/model/workbook.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/vue/src/components/Toolbar.vue`
- Modify: `packages/vue/src/components/GridCanvas.vue`
- Test: `packages/core/tests/paint-format.spec.ts`

**Interfaces:**
- Produces on Workbook:

```ts
export type PaintMode = {
  single: boolean;
  source: Array<Array<CellData | null>>;
  from: SelectionRange;
};
// workbook.paintMode: PaintMode | null = null
```

- Produces on Engine:
  - `startPaintFormat(single: boolean): boolean` — 多选返回 false
  - `cancelPaintFormat(): void`
  - `applyPaintFormatToSelection(): boolean` — 无 paintMode 返回 false
  - `isPaintFormatActive(): boolean`

- [ ] **Step 1: 写 engine 级测试**

```ts
it("startPaintFormat single applies once then clears", () => {
  const eng = new WorkbookEngine();
  eng.execute({ type: "setCellValue", row: 0, col: 0, value: 1 });
  eng.execute({ type: "setStyle", row: 0, col: 0, style: { bg: "#0f0" } });
  eng.execute({ type: "setSelection", selection: [{ row: [0, 0], column: [0, 0] }] });
  expect(eng.startPaintFormat(true)).toBe(true);
  expect(eng.workbook.paintMode?.single).toBe(true);
  expect(eng.workbook.copyHighlight).not.toBeNull();

  eng.execute({ type: "setCellValue", row: 1, col: 1, value: "t" });
  eng.execute({ type: "setSelection", selection: [{ row: [1, 1], column: [1, 1] }] });
  expect(eng.applyPaintFormatToSelection()).toBe(true);
  expect(eng.workbook.getCell(1, 1)?.bg).toBe("#0f0");
  expect(eng.workbook.getCell(1, 1)?.v).toBe("t");
  expect(eng.workbook.paintMode).toBeNull();
});

it("rejects paint with multi selection", () => {
  const eng = new WorkbookEngine();
  eng.execute({
    type: "setSelection",
    selection: [
      { row: [0, 0], column: [0, 0] },
      { row: [1, 1], column: [1, 1] },
    ],
  });
  expect(eng.startPaintFormat(true)).toBe(false);
});

it("cancelPaintFormat clears highlight", () => {
  const eng = new WorkbookEngine();
  eng.execute({ type: "setSelection", selection: [{ row: [0, 0], column: [0, 0] }] });
  eng.startPaintFormat(false);
  eng.cancelPaintFormat();
  expect(eng.workbook.paintMode).toBeNull();
  expect(eng.workbook.copyHighlight).toBeNull();
});
```

- [ ] **Step 2: 实现 engine API**

`startPaintFormat(single)`:
1. 若 `selection.length !== 1` return false  
2. `from = getActiveRange()`；`source = extractFormatMatrix(extractRange(...))`  
3. `paintMode = { single, source, from }`；`setCopyHighlight(from)`  
4. return true  

`applyPaintFormatToSelection()`:
1. 若无 paintMode / 无 active return false  
2. 计算目标 `r0,r1,c0,c1`；若 1×1 则 `rowCount/colCount = source` 尺寸，否则为目标尺寸  
3. `execute({ type: "paintFormat", ... })`  
4. 若 `single` → `cancelPaintFormat()`  
5. return true  

`copySelection` / `cutSelection` 开头：若 `paintMode` 则 `cancelPaintFormat()`。

`clearCopyHighlight` / Esc：若 paintMode 一并取消。

- [ ] **Step 3: Toolbar**

添加按钮「格式刷」：
- `@click` → `engine.startPaintFormat(true)`（若已在 paint 则 `cancelPaintFormat`）
- `@dblclick.prevent` → `engine.startPaintFormat(false)`
- 用 `@click` + 短延时区分双击时，避免 click 先触发 single：推荐

```ts
let paintClickTimer: ReturnType<typeof setTimeout> | null = null;
function onPaintClick() {
  if (props.engine.isPaintFormatActive()) {
    props.engine.cancelPaintFormat();
    return;
  }
  if (paintClickTimer) {
    clearTimeout(paintClickTimer);
    paintClickTimer = null;
    props.engine.startPaintFormat(false);
    return;
  }
  paintClickTimer = setTimeout(() => {
    paintClickTimer = null;
    props.engine.startPaintFormat(true);
  }, 250);
}
```

- [ ] **Step 4: GridCanvas**

- `pointerup` 在选区结束后：若 `isPaintFormatActive()` 则 `applyPaintFormatToSelection()`  
- Esc：优先 `cancelPaintFormat()`（已有 clearCopyHighlight 可合并）  
- `copy`/`cut` 前 engine 已取消 paint  
- template：`:class="{ 'ls3-grid--paint': engine.isPaintFormatActive() }"`  
- CSS：`.ls3-grid--paint { cursor: cell; }`（或 `crosshair`）

- [ ] **Step 5: 跑 `paint-format.spec.ts` 通过**

- [ ] **Step 6: Commit**（若用户要求）

```bash
git commit -m "feat: 格式刷状态机与工具栏/网格交互"
```

---

### Task 4: 合并提取与粘贴还原

**Files:**
- Modify: `packages/core/src/clipboard/clipboard.ts`
- Modify: `packages/core/src/command/types.ts`（`pasteCells.merges?`）
- Modify: `packages/core/src/command/bus.ts`
- Modify: `packages/core/src/engine.ts`（copy/paste 带 merges）
- Test: `packages/core/tests/clipboard.spec.ts`

**Interfaces:**
- Produces:

```ts
export type RelativeMerge = { r: number; c: number; rs: number; cs: number };

export function extractMerges(sheet: Sheet, range: SelectionRange): RelativeMerge[];
// ClipboardPayload.merges?: RelativeMerge[]
```

- [ ] **Step 1: 写失败测试**

```ts
import { extractMerges } from "../src/clipboard/clipboard.js";

it("extractMerges only fully-contained merges as relative", () => {
  const eng = new WorkbookEngine();
  eng.execute({ type: "mergeCells", row: 1, col: 1, rowCount: 2, colCount: 2 });
  const merges = extractMerges(eng.workbook.getActiveSheet(), {
    row: [1, 2],
    column: [1, 2],
  });
  expect(merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 2 }]);
});

it("paste restores merges at anchor", () => {
  const eng = new WorkbookEngine();
  eng.execute({ type: "setCellValue", row: 0, col: 0, value: "a" });
  eng.execute({ type: "mergeCells", row: 0, col: 0, rowCount: 2, colCount: 1 });
  eng.execute({ type: "setSelection", selection: [{ row: [0, 1], column: [0, 0] }] });
  eng.copySelection();
  eng.execute({ type: "setSelection", selection: [{ row: [0, 0], column: [2, 2] }] });
  eng.pasteAtSelection();
  const m = eng.workbook.getActiveSheet().getMergeAt(0, 2);
  expect(m).toEqual(expect.objectContaining({ r: 0, c: 2, rs: 2, cs: 1 }));
});
```

- [ ] **Step 2: 实现 extractMerges**

遍历 `sheet.config.merge`，若合并块完全落在 range 内，push `{ r: m.r - r0, c: m.c - c0, rs: m.rs, cs: m.cs }`。

- [ ] **Step 3: pasteCells 应用 merges；copySelection 填 merges**

```ts
// bus pasteCells 末尾:
for (const m of command.merges ?? []) {
  sheet.setMerge({
    r: anchorRow + m.r,
    c: anchorCol + m.c,
    rs: m.rs,
    cs: m.cs,
  });
}
```

`copySelection` / `cutSelection`：

```ts
merges: extractMerges(sheet, sel),
```

`pasteAtSelection` 把 `clip.merges` 传入 command。

- [ ] **Step 4: 跑 clipboard + paint-format 测试通过**

- [ ] **Step 5: Commit**（若用户要求）

```bash
git commit -m "feat: 复制粘贴还原合并格"
```

---

### Task 5: 富 HTML 解析与写出

**Files:**
- Modify: `packages/core/src/clipboard/serialize.ts`
- Modify: `packages/core/src/engine.ts`（`pasteFromExternal`）
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/clipboard.spec.ts`

**Interfaces:**
- Produces:

```ts
export type ClipboardParseResult = {
  cells: Array<Array<CellData | null>>;
  merges: RelativeMerge[];
};

export function parseHtmlTable(html: string): ClipboardParseResult;
export function parseClipboardPayload(input: {
  html?: string;
  text?: string;
}): ClipboardParseResult | null;

export function cellsToHtml(
  cells: Array<Array<CellData | null>>,
  merges?: RelativeMerge[],
): string;
```

注意：现有调用方若期望 `CellData[][]`，需同步改为 `.cells`（`engine.pasteFromExternal`、旧测试）。

- [ ] **Step 1: 写失败测试**

```ts
it("parseHtmlTable reads styles and rowspan", () => {
  const html = `<table><tr>
    <td rowspan="2" style="background-color:#ff0000;font-weight:bold;color:#00ff00">A</td>
    <td style="text-align:center">B</td>
  </tr><tr><td>C</td></tr></table>`;
  const { cells, merges } = parseHtmlTable(html);
  expect(cells[0][0]?.v).toBe("A");
  expect(cells[0][0]?.bg?.toLowerCase()).toMatch(/#ff0000|rgb/);
  expect(cells[0][0]?.bl).toBe(1);
  expect(cells[0][0]?.fc).toMatch(/#00ff00|#0f0|rgb/i);
  expect(cells[0][1]?.ht).toBe(0); // center
  expect(cells[1][0]).toBeNull(); // covered by rowspan
  expect(cells[1][1]?.v).toBe("C");
  expect(merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 1 }]);
});

it("cellsToHtml writes rowspan and basic style", () => {
  const html = cellsToHtml(
    [
      [{ v: "A", m: "A", bg: "#ff0", bl: 1 }, { v: "B", m: "B" }],
      [null, { v: "C", m: "C" }],
    ],
    [{ r: 0, c: 0, rs: 2, cs: 1 }],
  );
  expect(html).toContain('rowspan="2"');
  expect(html).toContain("background");
  expect(html).not.toMatch(/<tr><td><\/td><td>C/); // covered cell skipped
});

it("pasteFromExternal applies merges", () => {
  const eng = new WorkbookEngine();
  eng.execute({ type: "setSelection", selection: [{ row: [0, 0], column: [0, 0] }] });
  eng.pasteFromExternal({
    html: `<table><tr><td rowspan="2">X</td><td>Y</td></tr><tr><td>Z</td></tr></table>`,
  });
  expect(eng.getCellValue(0, 0)).toBe("X");
  expect(eng.workbook.getActiveSheet().getMergeAt(0, 0)?.rs).toBe(2);
});
```

颜色断言宽松：实现统一成 `#rrggbb` 小写即可，测试用 `toBe("#ff0000")`。

- [ ] **Step 2: 实现解析**

逻辑网格算法：
1. 先扫所有 tr，用占位矩阵 `occupied[r][c]`  
2. 每行从左找第一个未占用列放下当前 td  
3. `rs/cs` 标记占用；仅主格写入 `cells[r][c]`；占用格保持 `null`  
4. `rs>1 || cs>1` 时 push merge  

样式解析辅助：

```ts
function parseInlineStyle(styleAttr: string): Partial<CellData> {
  // split by `;`, map background-color/color/font-weight/font-style/font-size/text-align/border*
}
function normalizeColor(v: string): string | undefined {
  // #rgb → #rrggbb; leave #rrggbb; ignore named colors except transparent
}
```

`border`：若存在任一 border 声明，设 `bd: { t,b,l,r: { style: 1, color } }`（能解析颜色则用，否则 `#000000`）。

- [ ] **Step 3: 实现写出**

构建 `covered` Set from merges；遍历行列，跳过 covered；主格加 `rowspan`/`colspan` 与 `style="..."`.

- [ ] **Step 4: 更新 `parseClipboardPayload` / `pasteFromExternal` / `getClipboardHtml`**

```ts
pasteFromExternal(input) {
  const parsed = parseClipboardPayload(input);
  if (!parsed || !sel) return false;
  this.execute({
    type: "pasteCells",
    anchorRow: ...,
    anchorCol: ...,
    cells: parsed.cells,
    merges: parsed.merges,
  });
  return true;
}
```

`getClipboardHtml()`：`cellsToHtml(clip.cells, clip.merges)`。

修复旧测试：`parseHtmlTable` / `parseClipboardPayload` 解构 `.cells`。

- [ ] **Step 5: 全量测试**

Run: `cd packages/core && npx vitest run`
Expected: all PASS

- [ ] **Step 6: Commit**（若用户要求）

```bash
git commit -m "feat: HTML 富粘贴样式边框与合并"
```

---

### Task 6: FEATURE_MAP 与规格状态收尾

**Files:**
- Modify: `docs/FEATURE_MAP.md`
- Modify: `docs/superpowers/specs/2026-09-21-rich-paste-paint-format-design.md`（状态改为已实现）

- [ ] **Step 1: 更新 FEATURE_MAP**

- `select.js` / `selection.js` 行：注明格式刷 + 富粘贴（合并）已做；仍缺保护/粘贴选项/协同框  
- 工具栏「格式刷」从 `none` → `usable`  
- §6 Ctrl+C/X/V 旁可注「含 HTML 样式/合并」

- [ ] **Step 2: 规格头状态改为「已实现」**

- [ ] **Step 3: 全量 vitest 再跑一遍**

- [ ] **Step 4: Commit**（若用户要求）

```bash
git commit -m "docs: 更新格式刷与富粘贴进度"
```

---

## Spec Coverage Self-Review

| Spec 项 | Task |
|---|---|
| 格式刷 single/continuous/Esc | Task 3 |
| 刷样式不改 v/m/f | Task 1–2 |
| paintFormat 可撤销 | Task 2 |
| 多选禁止启动 | Task 3 |
| 应用内合并粘贴 | Task 4 |
| HTML 样式 + rowspan/colspan | Task 5 |
| cellsToHtml 写出 | Task 5 |
| 非目标未纳入 | 无对应任务 ✓ |
| FEATURE_MAP | Task 6 |

**Placeholder scan:** 无 TBD /「类似 Task N」。  
**Type consistency:** `RelativeMerge`、`ClipboardParseResult`、`paintFormat`、`PaintMode` 全计划统一。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-21-rich-paste-paint-format.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每任务派生子代理，任务间复查  
2. **Inline Execution** — 本会话按 executing-plans 连续执行并设检查点  

选哪种？
