# 行列头 DOM 化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 DOM 虚拟化渲染行/列头与角块，Canvas 只画单元格区；`freeze 0,0` 下交互与现网一致。

**Architecture:** 在 `@luckysheet3/core` 抽出 `visibleCellRange` 与 `buildHeaderLayout`，`canvas-renderer` 改为 cell-surface 坐标并移除表头绘制；`GridCanvas` 用 CSS Grid 分区，`GridHeaderRow/Col` 负责展示与指针事件。

**Tech Stack:** TypeScript、Vitest（core）、Vue 3 SFC、Vite。

**Spec:** `docs/superpowers/specs/2026-09-21-dom-grid-headers-design.md`

## Global Constraints

- 本轮仅保证 `freeze.row/col === 0`；`freeze > 0` 时表头不对齐可接受
- 不引入 `luckysheet-core.css` 表头段；无表头 hover 条、列菜单
- 不改命令语义（`setSelection`、`setRowHeight`、`setColWidth` 等）
- `ROW_HEADER_WIDTH = 46`、`COL_HEADER_HEIGHT = 20`（core 常量）
- 表头 resize 热区 `threshold = 3`，最小行高/列宽 `4`
- `engine.getCellRect()` 仍返回 **grid root** 坐标；`hitTest` 仍接收 grid 坐标
- `setViewport` 传入 **cell surface** 宽高（不含表头 gutter）
- 提交信息中文 `feat:` / `test:` / `docs:`；用户未要求提交则跳过 commit 步骤

## File Map

| 文件 | 职责 |
|------|------|
| `packages/core/src/layout/visible-range.ts` | 可见行列起止（freeze 0,0） |
| `packages/core/src/layout/header-layout.ts` | `buildHeaderLayout` |
| `packages/core/src/hit/location.ts` | content 坐标命中/resize 薄封装 |
| `packages/core/src/render/canvas-renderer.ts` | surface 绘制、去掉表头 |
| `packages/core/src/engine.ts` | `getViewport()` |
| `packages/core/src/index.ts` | 导出新 API |
| `packages/core/tests/header-layout.spec.ts` | layout + visible range 单测 |
| `packages/vue/src/components/GridCanvas.vue` | Grid 布局、canvas 坐标、删表头指针 |
| `packages/vue/src/components/GridHeaders.vue` | 订阅 engine、layout 编排 |
| `packages/vue/src/components/GridHeaderRow.vue` | 行头 DOM + 交互 |
| `packages/vue/src/components/GridHeaderCol.vue` | 列头 DOM + 交互 |
| `packages/vue/src/styles/grid-headers.css` | `.ls3-grid` 表头 token |
| `packages/vue/src/index.ts` | import `grid-headers.css` |

---

### Task 1: `visibleCellRange`

**Files:**
- Create: `packages/core/src/layout/visible-range.ts`
- Create: `packages/core/tests/header-layout.spec.ts`（本节只写 visible 相关用例）
- Modify: `packages/core/src/index.ts`（导出）

**Interfaces:**
- Produces:
```ts
export type VisibleRange = {
  scrollStartRow: number;
  endRow: number;
  scrollStartCol: number;
  endCol: number;
};

/** viewport = cell surface CSS 尺寸；freeze 固定按 0,0 */
export function visibleCellRange(
  sheet: Sheet,
  viewport: { width: number; height: number },
  scrollLeft: number,
  scrollTop: number,
  rowOffsets: number[],
  colOffsets: number[],
): VisibleRange;
```

- [ ] **Step 1: 写失败测试**

在 `packages/core/tests/header-layout.spec.ts` 添加：

```ts
import { describe, expect, it } from "vitest";
import { Sheet } from "../src/model/sheet.js";
import { buildRowOffsets, buildColOffsets } from "../src/hit/location.js";
import { visibleCellRange } from "../src/layout/visible-range.js";

describe("visibleCellRange (freeze 0,0)", () => {
  it("returns first visible rows/cols for scroll 0", () => {
    const sheet = new Sheet({ name: "s", rowCount: 100, colCount: 50 });
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
    const r = visibleCellRange(
      sheet,
      { width: 400, height: 300 },
      0,
      0,
      rowOffsets,
      colOffsets,
    );
    expect(r.scrollStartRow).toBe(0);
    expect(r.scrollStartCol).toBe(0);
    expect(r.endRow).toBeGreaterThanOrEqual(0);
    expect(r.endCol).toBeGreaterThanOrEqual(0);
  });

  it("advances start col when scrolled horizontally", () => {
    const sheet = new Sheet({ name: "s", rowCount: 10, colCount: 200 });
    sheet.setColWidth(0, 80);
    for (let c = 1; c < 200; c++) sheet.setColWidth(c, 80);
    const rowOffsets = buildRowOffsets(sheet);
    const colOffsets = buildColOffsets(sheet);
    const r = visibleCellRange(
      sheet,
      { width: 200, height: 100 },
      400,
      0,
      rowOffsets,
      colOffsets,
    );
    expect(r.scrollStartCol).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/header-layout.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `visible-range.ts`**

```ts
import type { Sheet } from "../model/sheet.js";
import { searchOffset } from "../hit/location.js";

export type VisibleRange = {
  scrollStartRow: number;
  endRow: number;
  scrollStartCol: number;
  endCol: number;
};

export function visibleCellRange(
  sheet: Sheet,
  viewport: { width: number; height: number },
  scrollLeft: number,
  scrollTop: number,
  rowOffsets: number[],
  colOffsets: number[],
): VisibleRange {
  const w = viewport.width;
  const h = viewport.height;
  const scrollStartCol = Math.max(0, searchOffset(colOffsets, scrollLeft));
  const endCol = Math.min(
    sheet.colCount - 1,
    searchOffset(colOffsets, scrollLeft + w) + 1,
  );
  const scrollStartRow = Math.max(0, searchOffset(rowOffsets, scrollTop));
  const endRow = Math.min(
    sheet.rowCount - 1,
    searchOffset(rowOffsets, scrollTop + h) + 1,
  );
  return { scrollStartRow, endRow, scrollStartCol, endCol };
}
```

`packages/core/src/index.ts` 增加：

```ts
export { visibleCellRange } from "./layout/visible-range.js";
export type { VisibleRange } from "./layout/visible-range.js";
```

- [ ] **Step 4: 运行测试**

Run: `cd packages/core && npm test -- tests/header-layout.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layout/visible-range.ts packages/core/tests/header-layout.spec.ts packages/core/src/index.ts
git commit -m "feat(core): 抽出 visibleCellRange 供表头与渲染共用"
```

---

### Task 2: Canvas 改为 cell-surface 坐标并移除表头绘制

**Files:**
- Modify: `packages/core/src/render/canvas-renderer.ts`
- Test: `packages/core/tests/header-layout.spec.ts`（可选加 engine 烟雾测试）

**Interfaces:**
- Consumes: `visibleCellRange` from Task 1
- Produces: `CanvasRenderer.paint` 在 `(0,0)–(w,h)` 绘制单元格/选区；**不再**绘制表头灰底与表头选中块

- [ ] **Step 1: 在 `paint` 开头用 `visibleCellRange` 替换内联的 scrollStart/end 计算**

删除对 `ROW_HEADER_WIDTH` / `COL_HEADER_HEIGHT` 的表头 `fillRect` / `paintColHeader` / `paintRowHeader` / 表头 `headerAgg` 整块（约 L133–233）。

单元格循环改用 Task 1 的 range；clip 矩形改为全 surface：

```ts
ctx.rect(0, 0, w, h);
```

- [ ] **Step 2: 绘制坐标减 gutter**

在 `paint` 内定义：

```ts
const gx = ROW_HEADER_WIDTH;
const gy = COL_HEADER_HEIGHT;
```

对每个 `getCellRect` 得到的 `rect`，绘制用：

```ts
const sx = rect.x - gx;
const sy = rect.y - gy;
```

选区、复制虚线、`getFillHandleRect` 结果同样减 `gx/gy`。冻结带分隔线（`freeze.row/col > 0`）若仍保留，y/x 也用 surface 坐标：`band.height`、`band.width`（无 gutter 偏移）。

- [ ] **Step 3: 运行 core 全量测试**

Run: `cd packages/core && npm test`
Expected: PASS（若有失败，检查 `getFillHandleRect`/`hitTest` 测试是否假设旧 viewport 含 gutter——`getCellRect` 不应改）

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/render/canvas-renderer.ts
git commit -m "feat(core): canvas 仅绘制单元格区并改用 surface 坐标"
```

---

### Task 3: Content 坐标命中辅助

**Files:**
- Modify: `packages/core/src/hit/location.ts`
- Modify: `packages/core/tests/header-layout.spec.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:

```ts
export function rowIndexAtContentY(
  sheet: Sheet,
  contentY: number,
  rowOffsets: number[],
): number | null;

export function colIndexAtContentX(
  sheet: Sheet,
  contentX: number,
  colOffsets: number[],
): number | null;

/** 行底边在 content 坐标系，用于行高拖拽 */
export function rowResizeIndexAtContentY(
  sheet: Sheet,
  contentY: number,
  rowOffsets: number[],
  threshold = 3,
): number | null;

export function colResizeIndexAtContentX(
  sheet: Sheet,
  contentX: number,
  colOffsets: number[],
  threshold = 3,
): number | null;
```

- [ ] **Step 1: 写失败测试**

```ts
import {
  rowIndexAtContentY,
  colIndexAtContentX,
  buildRowOffsets,
  buildColOffsets,
} from "../src/hit/location.js";

it("rowIndexAtContentY maps content offset to row", () => {
  const sheet = new Sheet({ name: "s", rowCount: 5, colCount: 3 });
  sheet.setRowHeight(0, 30);
  const rowOffsets = buildRowOffsets(sheet);
  expect(rowIndexAtContentY(sheet, 5, rowOffsets)).toBe(0);
  expect(rowIndexAtContentY(sheet, 35, rowOffsets)).toBe(1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/core && npm test -- tests/header-layout.spec.ts`

- [ ] **Step 3: 实现（freeze 0,0 路径）**

`rowIndexAtContentY`: `searchOffset(rowOffsets, contentY)`，clamp 到 `[0, rowCount-1]`，隐藏行返回 `null`（与 `hitRowHeader` 一致）。

`rowResizeIndexAtContentY`: 遍历 `r`，`edge = rowOffsets[r]`，`|contentY - edge| <= threshold` 则返回 `r`（跳过 hidden）。

列对称实现。

导出四个函数于 `index.ts`。

- [ ] **Step 4: 运行测试**

Run: `cd packages/core && npm test`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hit/location.ts packages/core/tests/header-layout.spec.ts packages/core/src/index.ts
git commit -m "feat(core): content 坐标行列表头命中与 resize 辅助"
```

---

### Task 4: `buildHeaderLayout`

**Files:**
- Create: `packages/core/src/layout/header-layout.ts`
- Modify: `packages/core/tests/header-layout.spec.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `visibleCellRange`, `aggregateRowColHeaders`, `colToLetter`, `buildRowOffsets`, `buildColOffsets`, `rowTop`, `colLeft`
- Produces:

```ts
export type HeaderLayoutItem = {
  index: number;
  label: string;
  offset: number;
  size: number;
};

export type HeaderSelectionBand = {
  startIndex: number;
  endIndex: number;
};

export type HeaderLayout = {
  rowItems: HeaderLayoutItem[];
  colItems: HeaderLayoutItem[];
  rowSelection: HeaderSelectionBand[];
  colSelection: HeaderSelectionBand[];
  scrollLeft: number;
  scrollTop: number;
};

export function buildHeaderLayout(
  workbook: Workbook,
  viewport: { width: number; height: number },
): HeaderLayout;
```

- [ ] **Step 1: 写失败测试**

```ts
import { Workbook } from "../src/model/workbook.js";
import { buildHeaderLayout } from "../src/layout/header-layout.js";

it("buildHeaderLayout labels and buffer", () => {
  const wb = new Workbook();
  const layout = buildHeaderLayout(wb, { width: 500, height: 400 });
  expect(layout.colItems.length).toBeGreaterThan(0);
  expect(layout.colItems[0].label).toBe("A");
  expect(layout.rowItems[0].label).toBe("1");
  expect(layout.scrollLeft).toBe(0);
});

it("maps selection to header bands", () => {
  const eng = new WorkbookEngine();
  eng.selectRow(0);
  const layout = buildHeaderLayout(eng.workbook, { width: 400, height: 300 });
  expect(layout.rowSelection.length).toBeGreaterThan(0);
  expect(layout.rowSelection[0].startIndex).toBe(0);
});
```

- [ ] **Step 2: 实现 `header-layout.ts`**

逻辑：

1. `buildRowOffsets` / `buildColOffsets`
2. `visibleCellRange` → `startRow = max(0, scrollStartRow - 1)` 等 buffer
3. 循环 `r`/`c`，跳过 `hiddenRows`
4. `offset = rowTop(rowOffsets, r)` / `colLeft(colOffsets, c)`
5. `size = getRowHeight` / `getColWidth`
6. `aggregateRowColHeaders(workbook.selection)` → `rowSelection`/`colSelection` 映射为 `{ startIndex, endIndex }`

- [ ] **Step 3: 导出并跑测试**

Run: `cd packages/core && npm test`

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/layout/header-layout.ts packages/core/tests/header-layout.spec.ts packages/core/src/index.ts
git commit -m "feat(core): buildHeaderLayout 供 DOM 表头虚拟化"
```

---

### Task 5: `WorkbookEngine.getViewport`

**Files:**
- Modify: `packages/core/src/engine.ts`

**Interfaces:**
- Produces: `getViewport(): { width: number; height: number }` 只读副本

- [ ] **Step 1: 添加方法**

```ts
getViewport(): { width: number; height: number } {
  return { ...this.viewport };
}
```

- [ ] **Step 2: typecheck**

Run: `cd packages/core && npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/engine.ts
git commit -m "feat(core): 暴露 getViewport 供表头布局"
```

---

### Task 6: `GridCanvas` 布局与 viewport 测量

**Files:**
- Modify: `packages/vue/src/components/GridCanvas.vue`

**Interfaces:**
- Consumes: `ROW_HEADER_WIDTH`, `COL_HEADER_HEIGHT`, `GridHeaders`（Task 7 创建后可先空壳 import）

- [ ] **Step 1: 模板改为 CSS Grid**

```vue
<div ref="wrapRef" class="ls3-grid" ...>
  <GridHeaders :engine="props.engine" :grid-root="wrapRef" />
  <div ref="cellSurfaceRef" class="ls3-grid__surface">
    <canvas ref="canvasRef" class="ls3-grid__canvas" />
    <slot ... />
  </div>
</div>
```

`GridHeaders` 使用 `display: contents` 或子元素直接参与 grid（推荐：`GridHeaders` 根为 `display: contents`，内含 corner/col/row 三个 grid 子项）。

Grid 样式：

```css
.ls3-grid {
  display: grid;
  grid-template-columns: var(--ls3-row-header-width, 46px) 1fr;
  grid-template-rows: var(--ls3-col-header-height, 20px) 1fr;
}
.ls3-grid__surface {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 2: `measure()` 量 `cellSurfaceRef`**

```ts
const cellSurfaceRef = ref<HTMLDivElement | null>(null);
// ResizeObserver observe cellSurfaceRef
const rect = cellSurfaceRef.value!.getBoundingClientRect();
props.engine.setViewport(Math.max(100, rect.width), Math.max(100, rect.height));
```

- [ ] **Step 3: Canvas 指针坐标转 grid**

```ts
function surfacePos(e: PointerEvent) {
  const el = cellSurfaceRef.value!;
  const rect = el.getBoundingClientRect();
  return {
    x: e.clientX - rect.left + ROW_HEADER_WIDTH,
    y: e.clientY - rect.top + COL_HEADER_HEIGHT,
  };
}
```

`onPointerDown/Move` 绑定在 **canvas**（或 surface）上，用 `surfacePos` 替代原 `localPos` 用于 `hitTest`、fill、select。

- [ ] **Step 4: 暂时保留旧表头指针逻辑**（Task 8 再删），确认 playground 单元格区仍可用

Run: `cd packages/vue && npm run typecheck`（及 monorepo dev 手动点格）

- [ ] **Step 5: Commit**

```bash
git add packages/vue/src/components/GridCanvas.vue
git commit -m "feat(vue): GridCanvas 分区布局与 cell surface 视口"
```

---

### Task 7: DOM 表头只读渲染

**Files:**
- Create: `packages/vue/src/components/GridHeaders.vue`
- Create: `packages/vue/src/components/GridHeaderRow.vue`
- Create: `packages/vue/src/components/GridHeaderCol.vue`
- Create: `packages/vue/src/styles/grid-headers.css`
- Modify: `packages/vue/src/index.ts`

**Interfaces:**
- Consumes: `buildHeaderLayout`, `ROW_HEADER_WIDTH`, `COL_HEADER_HEIGHT`, `engine.getViewport()`, `engine.on`

- [ ] **Step 1: `grid-headers.css` token**（见 spec §7）

- [ ] **Step 2: `GridHeaders.vue`**

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import type { WorkbookEngine, HeaderLayout } from "@luckysheet3/core";
import { buildHeaderLayout } from "@luckysheet3/core";
import GridHeaderRow from "./GridHeaderRow.vue";
import GridHeaderCol from "./GridHeaderCol.vue";

const props = defineProps<{
  engine: WorkbookEngine;
  gridRoot: HTMLElement | null;
}>();

const layout = shallowRef<HeaderLayout | null>(null);

function refresh() {
  layout.value = buildHeaderLayout(props.engine.workbook, props.engine.getViewport());
}

let off: (() => void) | undefined;
onMounted(() => {
  refresh();
  off = props.engine.on(() => refresh());
});
onUnmounted(() => off?.());
</script>
```

角块：`.ls3-grid__corner` grid-area；`@click` → `engine.selectAll()`（交互 Task 8 可加强编辑态）。

- [ ] **Step 3: `GridHeaderCol.vue`**

- 外层 `overflow: hidden`
- 内层 `:style="{ transform: \`translateX(${-layout.scrollLeft}px)\` }"`
- `v-for="item in layout.colItems"` 绝对定位：`left: item.offset px`，`width: item.size`，显示 `item.label`
- selection band 层：`left = colLeft + offset - scroll`（用 item.offset 与 band 的 start/end index 算像素）

- [ ] **Step 4: `GridHeaderRow.vue`**（对称，`translateY`）

- [ ] **Step 5: `index.ts` 增加** `import "./styles/grid-headers.css"`

- [ ] **Step 6: 手动验证** playground 滚动后表头与格子对齐；canvas 无重复表头文字

- [ ] **Step 7: Commit**

```bash
git add packages/vue/src/components/GridHeaders.vue packages/vue/src/components/GridHeaderRow.vue packages/vue/src/components/GridHeaderCol.vue packages/vue/src/styles/grid-headers.css packages/vue/src/index.ts packages/vue/src/components/GridCanvas.vue
git commit -m "feat(vue): DOM 虚拟化行列头渲染"
```

---

### Task 8: 表头交互并清理 `GridCanvas`

**Files:**
- Modify: `packages/vue/src/components/GridHeaderRow.vue`
- Modify: `packages/vue/src/components/GridHeaderCol.vue`
- Modify: `packages/vue/src/components/GridHeaders.vue`（角块编辑态）
- Modify: `packages/vue/src/components/GridCanvas.vue`

**Interfaces:**
- Consumes: `rowIndexAtContentY`, `colIndexAtContentX`, `rowResizeIndexAtContentY`, `colResizeIndexAtContentX`, `buildRowOffsets`, `buildColOffsets`

- [ ] **Step 1: 行头 `pointerdown`**

```ts
const contentY = clientY - rowHeaderRect.top + engine.workbook.scrollTop;
// 先 resize: rowResizeIndexAtContentY
// 再 rowIndexAtContentY → selectRow(index, { shift })
props.gridRoot?.focus();
```

`pointermove` + capture：`headerDrag` → `selectRow(start, { endRow })`

`setRowHeight`：`height: Math.max(4, startSize + deltaY)`

- [ ] **Step 2: 列头对称**（`contentX` + scrollLeft）

- [ ] **Step 3: 编辑中点击**

表头/角块 `pointerdown`：若 `engine.editing` → `commitEdit()` 再选中（复制 `GridCanvas` 现有分支）

- [ ] **Step 4: 从 `GridCanvas.vue` 删除**

`headerDrag`、`hitRowHeader`、`hitColHeader`、`hitCorner`、`hitRowResize`、`hitColResize` 及相关 `resizing` 分支（行/列 resize 仅在表头）

- [ ] **Step 5: 全量测试 + 手工清单（spec §8）**

Run: `cd packages/core && npm test`

- [ ] **Step 6: Commit**

```bash
git add packages/vue/src/components/GridHeaderRow.vue packages/vue/src/components/GridHeaderCol.vue packages/vue/src/components/GridHeaders.vue packages/vue/src/components/GridCanvas.vue
git commit -m "feat(vue): 表头点选拖选与改行列尺寸"
```

---

### Task 9: 文档与 spec 状态

**Files:**
- Modify: `docs/superpowers/specs/2026-09-21-dom-grid-headers-design.md`（状态 → 已实现或进行中，按实际）
- Optional: `docs/FEATURE_MAP.md` 一行备注

- [ ] **Step 1: 更新 spec 状态行**

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-21-dom-grid-headers-design.md
git commit -m "docs: 行列头 DOM 化 spec 标记已实现"
```

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| `visibleCellRange` freeze 0,0 | 1 |
| canvas 无表头、surface 坐标 | 2 |
| `buildHeaderLayout` + buffer | 4 |
| content 命中 | 3 |
| `getViewport` | 5 |
| CSS Grid 布局 | 6 |
| DOM 虚拟化表头 | 7 |
| 表头交互 / GridCanvas 清理 | 8 |
| CSS token | 7 |
| 单测 | 1, 3, 4 |
| 手工验收 | 8 |

## Manual Test Checklist

- [ ] 滚轮：表头与单元格同步移动
- [ ] 点行头、列头、Shift 扩选、拖选多行/列
- [ ] 拖行底/列右边改尺寸，最小 4px
- [ ] 角块全选；编辑中点表头先提交
- [ ] 单元格选择、填充柄、F2 编辑、Ctrl+C/V 正常
