# 行列头 DOM 化

- 日期：2026-09-21
- 状态：已实现
- 范围：将行头、列头、左上角从 Canvas 绘制改为 DOM；行为与现网一致（`freeze 0,0`）
- 对照：Luckysheet 2.x 表头为 DOM + 分区事件（`#luckysheet-rows-h`、`#luckysheet-cols-h-c`、`#luckysheet-left-top`）；本轮不照搬其 CSS/DOM 结构

## 1. 目标

用 DOM 渲染行列头与左上角，单元格区仍用 Canvas。交互保持现状：点选行/列、拖选、角块全选、拖拽改行高/列宽；选中高亮与现 canvas 表头一致。

成功标准（playground，`freeze.row/col === 0`）：

- 表头为 DOM 文本，滚动时与网格对齐
- 上述表头交互可用；单元格区选择、填充、编辑、剪贴板未退化
- Canvas 不再绘制灰底行号/列字母及表头选中块

## 2. 非目标（本轮不做）

- 冻结窗格下的表头拆分或与冻结带对齐（`freeze > 0` 时表头按无冻结滚动，可与冻结单元格视觉不齐，后续专章）
- 原版表头 hover 条、列菜单按钮、行/列右键菜单
- 表头样式像素级复刻；不引入 `luckysheet-core.css` 表头段
- 整表高度/宽度的占位 DOM + 独立 scroll 容器（采用视口虚拟化）
- 修改命令语义（`setSelection`、`setRowHeight` 等保持不变）

## 3. 已确认决策

| 项 | 选择 |
|---|---|
| 外观 | 行为对齐；本项目 CSS token；不照搬原版 DOM/CSS |
| 冻结 | 本轮仅 `freeze 0,0` |
| 事件 | 表头 DOM 自管（贴近原版分区，非整页 canvas 统一命中） |
| 渲染 | 视口虚拟化 + `transform` 对齐 scroll，不建整表占位 |
| 实现路径 | **方案 1**：core 抽出 `visibleCellRange` / `buildHeaderLayout`；Vue 布局 + 表头组件 |

## 4. 布局与组件

### 4.1 `GridCanvas.vue`（CSS Grid）

```
┌ corner ──── col header ────────────────┐
│ 46×20      │  虚拟化列头                 │
├────────────┼───────────────────────────┤
│ row header │  cell surface (canvas)    │
└────────────┴───────────────────────────┘
```

- 尺寸：`ROW_HEADER_WIDTH`（46）、`COL_HEADER_HEIGHT`（20），来自 `@luckysheet3/core`
- 滚轮：仍绑 `.ls3-grid` → `setScroll`
- 焦点 / 键盘：`.ls3-grid`；表头 `pointerdown` 后 `focus()` 根容器
- z-index：表头 2，canvas 0，`CellEditor` 3

### 4.2 Vue 组件

| 组件 | 职责 |
|------|------|
| `GridHeaders.vue` | 订阅 engine 事件，调用 `buildHeaderLayout`，编排子块 |
| `GridHeaderCol.vue` | 虚拟列头、列选中层、列宽拖拽 |
| `GridHeaderRow.vue` | 虚拟行头、行选中层、行高拖拽 |
| 角块 | `GridHeaders` 内联或 `GridHeaderCorner.vue` |

列/行容器 `overflow: hidden`；内层 `translateX(-scrollLeft)` / `translateY(-scrollTop)`，**不**使用表头独立 scroll（本轮无冻结）。

选中高亮：layout 的 `rowSelection` / `colSelection` 映射为绝对定位 band 层。

### 4.3 Canvas 与视口

- `measure()` 量 **cell surface** 宽高 → `engine.setViewport(w, h)`
- `canvas-renderer`：删除表头绘制；单元格/选区/复制框在 **cell surface** 坐标绘制（`x' = gridX - ROW_HEADER_WIDTH`，`y' = gridY - COL_HEADER_HEIGHT`）
- `engine.getCellRect()` 仍返回 **grid root** 坐标（`CellEditor` 不变）
- 单元格指针：仅 canvas/cell surface；本地坐标加 gutter 后调 `hitTest` 等
- 若 Vue 需读视口：为 `WorkbookEngine` 增加只读 `getViewport()`（或等价 getter）

### 4.4 文件

```
packages/core/src/layout/visible-range.ts
packages/core/src/layout/header-layout.ts
packages/core/src/render/canvas-renderer.ts   # 删表头、surface 坐标
packages/vue/src/components/GridHeaders.vue
packages/vue/src/components/GridHeaderRow.vue
packages/vue/src/components/GridHeaderCol.vue
packages/vue/src/composables/useGridHeaderInteraction.ts  # 可选，抽 drag/resize
packages/vue/src/styles/grid-headers.css
packages/vue/src/components/GridCanvas.vue
packages/vue/src/index.ts                     # import grid-headers.css
```

## 5. Core API

### 5.1 `visibleCellRange`

从 `canvas-renderer.paint` 抽出可见行列起止；入参 viewport 为 cell surface 尺寸。本轮内部按 `freeze {0,0}` 计算（不实现冻结带裁剪）。

### 5.2 `buildHeaderLayout(workbook, viewport)`

返回：

- `rowItems` / `colItems`：`index`、`label`（行 `n+1`，列 `colToLetter`）、`offset`（内容坐标）、`size`
- `rowSelection` / `colSelection`：`aggregateRowColHeaders` 的索引区间
- `scrollLeft` / `scrollTop`
- 可见范围前后 **buffer 1** 行/列；`hiddenRows` 跳过 item 渲染

### 5.3 坐标空间

| 空间 | 用途 |
|------|------|
| Grid root | `getCellRect`、`CellEditor` |
| Cell surface | canvas 绘制、canvas 指针本地坐标 |
| Content | scroll、`offset`、表头命中 |

`hitTest(px, py)` 仍为 **grid** 坐标。表头命中用 content 坐标 + `searchOffset`（或 `rowIndexAtContentY` / `colIndexAtContentX` 薄封装）。

保留导出 `hitRowHeader` / `hitColHeader` / `hitCorner` 供单测；`GridCanvas` 不再调用。

## 6. 表头交互

从 `GridCanvas` 迁至表头组件（或 `useGridHeaderInteraction`）：

| 手势 | 行为 |
|------|------|
| 表头格 `pointerdown` | `selectRow` / `selectColumn`；支持 Shift |
| 拖选 | `selectRow(start, { endRow })` / `selectColumn(start, { endCol })` |
| 底边/右边 3px 热区 | `setRowHeight` / `setColWidth`，最小 4px；resize 优先于点选 |
| 角块点击 | `selectAll()` |
| 编辑中点表头 | `commitEdit()` 后选中（与现逻辑一致） |

`GridCanvas` 保留：单元格选择、填充柄、fill、滚轮、剪贴板快捷键等。

## 7. 样式

`packages/vue/src/styles/grid-headers.css`，选择器挂在 `.ls3-grid` 下：

| Token | 值 |
|--------|-----|
| `--ls3-header-bg` | `#f5f5f5` |
| `--ls3-header-corner-bg` | `#f0f0f0` |
| `--ls3-header-border` | `#d4d4d4` |
| `--ls3-header-text` | `#5a5a5a` |
| `--ls3-header-select` | `rgba(76, 76, 76, 0.1)` |

12px 居中标签；无表头 hover 条。

## 8. 测试

**Core**

- `visibleCellRange`、`buildHeaderLayout` 单元测试
- `freeze 0,0` 下 `getCellRect` / `hitTest` 回归（grid 坐标）

**手工**

- 滚动对齐、快速滚动露白
- 行/列点选、Shift、拖选
- 改行高/列宽；编辑中点表头
- 角块全选；单元格交互未退化

**边界**：`rowCount/colCount === 0` 时 layout 返回空列表，不抛错。

## 9. 实现顺序建议

1. `visibleCellRange` + renderer 改用 surface 坐标并去掉表头
2. `buildHeaderLayout` + 单测
3. `GridCanvas` grid 布局 + viewport 测量
4. `GridHeaders` 只读渲染对齐
5. 表头交互与从 `GridCanvas` 删表头逻辑
6. `grid-headers.css` + playground 验收
