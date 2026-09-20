# 工具栏补强 Implementation Plan

> Inline execution. Checkbox tracking.

**Goal:** 补齐日常格式操作：字号、颜色选择器、垂直对齐、数字格式、B/I 切换、清除格式。

**Architecture:** 格式写入仍走 `setStyle` / 新 `setFormat` 命令（可 undo）；显示串 `m` 由 core `formatDisplay` 计算；Vue Toolbar 增加 select / color input，并根据选区首格同步当前状态。

## Scope

- 做：字号、fc/bg 取色、ht 已有 + vt、数字格式预设、B/I 切换、清除格式
- 不做：完整 Excel 格式串引擎、条件格式、字体族全表、主题色板弹层

## 文件

```
packages/core/src/format/number-format.ts   # formatDisplay + presets
packages/core/src/command/types.ts          # setFormat
packages/core/src/command/bus.ts
packages/core/src/engine.ts                 # applyFormat / clearFormat / toggle
packages/vue/src/components/Toolbar.vue
packages/core/tests/format.spec.ts
```

## 数字格式预设

| id | fa | t | 行为 |
|---|---|---|---|
| general | General | g/n | m = String(v) |
| number | 0.00 | n | 两位小数 |
| percent | 0% | n | v*100 + % |
| currency | ¥#,##0.00 | n | ¥ 前缀两位 |
| date | yyyy-MM-dd | d | 已是日期串则保留；数字按日序列简化 |
| text | @ | s | m = String(v) |

## Toolbar UI

- `<select>` 字号 8–24
- `<input type="color">` 字体色 / 填充色
- B/I 点击切换 0↔1（读选区首格）
- Top / Middle / Bottom（vt）
- `<select>` 数字格式
- Clear Fmt

## 验收

- [x] core 单测：format + applyFormat undo
- [x] `pnpm --filter @luckysheet3/core test` 全绿（46）
