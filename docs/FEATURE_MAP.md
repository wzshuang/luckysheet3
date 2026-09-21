# Luckysheet → luckysheet3 功能映射表（FEATURE_MAP）

- 原版：`D:\dev\git\github.com\Luckysheet`（2.1.13）
- 本项目：`D:\dev\git\github.com\luckysheet3`
- 生成时点：2026-09-20
- 用途：按**原模块 → 新实现**追踪缺口；**不是**目录镜像，也不可逐行 diff

## 状态图例


| 状态         | 含义                    |
| ---------- | --------------------- |
| `none`     | 未实现                   |
| `skeleton` | 有入口/类型/透传，几乎不可用或仅 API |
| `usable`   | 日常可用，但行为/选项少于原版       |
| `parity`   | 行为与原版基本对等（当前极少）       |


路径约定：

- `core/` = `packages/core/src/`
- `vue/` = `packages/vue/src/`
- `compat/` = `packages/compat/src/`

---

## 0. 总览


| 类别          | 原版规模                 | 本项目现状（粗估）                                |
| ----------- | -------------------- | ---------------------------------------- |
| controllers | 46 文件                | 多数 `none` / 少数 `usable`                  |
| global      | 31 文件                | 核心绘制/坐标/边框/公式有对应；API/排序等大量 `none`        |
| function    | 374 公式               | ~22 个 builtins                           |
| api.js      | 109 export           | compat 仅 create/destroy/get/setCellValue |
| 插件          | chart / xlsx / print | `none`                                   |
| 协同          | server + WebSocket   | 仅 `emit('op')`，不联网                       |


当前命令面（`core/command/types.ts`）：  
`setCellValue` `setStyle` `setSelection` `switchSheet` `setScroll`  
`mergeCells` `unmergeCells` `insertRows/Cols` `deleteRows/Cols`  
`setRowHeight` `setColWidth` `pasteCells` `fillCells` `setFreeze`  
`replaceAll` `setFilter` `setBorders` `setFormat` `clearFormat`  
`addSheet` `deleteSheet` `renameSheet`

---

## 1. controllers/


| 原文件                                   | 能力摘要                  | 新实现位置                                                          | 状态       | 主要缺口                                     |
| ------------------------------------- | --------------------- | -------------------------------------------------------------- | -------- | ---------------------------------------- |
| `handler.js`                          | 网格指针/滚轮/双击编辑/选区拖拽等总入口 | `vue/components/GridCanvas.vue` + `core/engine.ts`             | usable   | 右键前逻辑；细节持续对拍；公式编辑中选区引用未做 |
| `keyboard.js`                         | 全套快捷键                 | `GridCanvas.vue` `onKeyDown`                                   | usable   | Ctrl+A/Shift 方向键已绑；仍缺大量格式快捷键 |
| `select.js` / `selection.js`          | 选区高亮、名称框、多选           | `selection/range.ts` + engine select* + canvas-renderer + selectionToLabel | usable   | **A 档已做** focus/Shift/Ctrl/行列表头/多选绘制；**B 档已做** 复制虚线 + TSV/HTML 粘贴；仍缺格式刷、协同框 |
| `formulaBar.js`                       | 公式栏                   | `vue/components/FormulaBar.vue`                                | usable   | 公式编辑时选区引用插入、名称框跳转                        |
| `toolbar.js`                          | 工具栏按钮编排               | `vue/components/Toolbar.vue`                                   | usable   | 见 §5 工具栏细项                               |
| `menuButton.js`                       | 工具栏下拉 + 右键菜单          | —                                                              | none     | 右键菜单整体缺失                                 |
| `constant.js`                         | HTML 字符串模板外壳          | `vue/components/LuckySheet.vue` 等                              | usable   | 结构已 Vue 化，无字符串模板                         |
| `controlHistory.js`                   | 撤销重做                  | `core/command/bus.ts`                                          | usable   | 历史粒度/合并策略与原版不同                           |
| `updateCell.js`                       | 写格刷新                  | `setCellValue` / CommandBus + paint                            | usable   |                                          |
| `cellFormat.js`                       | 单元格格式面板               | `format/number-format.ts` + Toolbar                            | skeleton | 完整格式对话框、更多格式串                            |
| `moreFormat.js`                       | 更多数字格式                | Toolbar 6 个预设                                                  | skeleton |                                          |
| `freezen.js`                          | 冻结                    | `setFreeze` + hit/renderer 分带                                  | usable   | 冻结首行/首列多种菜单项、拖拽冻结条                       |
| `dropCell.js`                         | 填充柄                   | `clipboard/clipboard.ts`                                       | usable   | 填充选项对话框、更多序列类型                           |
| `searchReplace.js`                    | 查找替换                  | `find/find-replace.ts` + `FindReplaceDialog.vue`               | usable   | 按范围/公式/正则等                               |
| `filter.js`                           | 筛选                    | `setFilter` / `hiddenRows`                                     | skeleton | **无列头漏斗 UI**                             |
| `orderBy.js`                          | 排序                    | —                                                              | none     |                                          |
| `rowColumnOperation.js`               | 行列增删隐藏等               | insert/delete + resize                                         | usable   | 隐藏行列、批量操作 UI                             |
| `resize.js`                           | 行列拖拽调宽高               | `hitRowResize` / `hitColResize` + GridCanvas                   | usable   |                                          |
| `sheetBar.js`                         | Sheet 标签栏             | `vue/components/SheetBar.vue`                                  | usable   | 颜色、右键菜单                                  |
| `sheetmanage.js`                      | Sheet 增删复制隐藏排序        | add/delete/rename                                              | usable   | 复制、隐藏、颜色、顺序拖拽                            |
| `sheetMove.js`                        | Sheet 拖拽排序            | —                                                              | none     |                                          |
| `sheetSearch.js`                      | Sheet 内搜索辅助           | 部分在 find                                                       | skeleton |                                          |
| `server.js`                           | 协同保存/WS               | `emit('op')` only                                              | skeleton | 无 WebSocket、无 OT 对等                      |
| `listener.js`                         | 钩子监听                  | `workbook.on`                                                  | usable   | 事件种类少于原版                                 |
| `luckysheetConfigsetting.js`          | 全局配置                  | props 少量                                                       | skeleton | 配置面极窄                                    |
| `locationCell.js`                     | 定位单元格类型               | —                                                              | none     |                                          |
| `insertFormula.js`                    | 插入函数面板                | —                                                              | none     |                                          |
| `ifFormulaGenerator.js`               | IF 生成器                | —                                                              | none     |                                          |
| `pivotTable.js`                       | 透视表                   | —                                                              | none     |                                          |
| `postil.js`                           | 批注                    | —                                                              | none     |                                          |
| `protection.js`                       | 保护                    | —                                                              | none     |                                          |
| `imageCtrl.js` / `imageUpdateCtrl.js` | 图片                    | —                                                              | none     |                                          |
| `hyperlinkCtrl.js`                    | 超链接                   | —                                                              | none     |                                          |
| `dataVerificationCtrl.js`             | 数据校验                  | —                                                              | none     |                                          |
| `conditionformat.js`                  | 条件格式                  | —                                                              | none     |                                          |
| `alternateformat.js`                  | 交替颜色                  | —                                                              | none     |                                          |
| `inlineString.js`                     | 富文本单元格                | —                                                              | none     |                                          |
| `sparkline.js`                        | 迷你图                   | —                                                              | none     |                                          |
| `matrixOperation.js`                  | 矩阵操作                  | —                                                              | none     |                                          |
| `splitColumn.js`                      | 分列                    | —                                                              | none     |                                          |
| `zoom.js`                             | 缩放                    | —                                                              | none     |                                          |
| `mobile.js`                           | 移动端                   | —                                                              | none     |                                          |
| `cellDatePickerCtrl.js`               | 日期选择器                 | —                                                              | none     |                                          |
| `expendPlugins.js`                    | 插件加载                  | —                                                              | none     |                                          |


---

## 2. global/


| 原文件                         | 能力摘要                 | 新实现位置                              | 状态         | 主要缺口                 |
| --------------------------- | -------------------- | ---------------------------------- | ---------- | -------------------- |
| `draw.js`                   | Canvas 视口绘制          | `render/canvas-renderer.ts`        | usable     | 溢出文字、条件格式绘制、批注角标、图表层 |
| `location.js`               | 坐标 / hit-test        | `hit/location.ts`                  | usable     |                      |
| `border.js`                 | 边框计算                 | `border/borders.ts`                | usable     | 线型全集、内侧/斜线           |
| `format.js`                 | 显示格式                 | `format/number-format.ts`          | skeleton   | 完整 Excel 格式串         |
| `formula.js`                | 公式解析重算               | `formula/parser.ts` `evaluator.ts` | skeleton   | 依赖图精度、数组公式、命名区域      |
| `api.js`                    | 109 公开 API           | `compat/index.ts` + engine 方法      | skeleton   | 绝大多数 API 未暴露         |
| `editor.js`                 | 编辑态                  | `CellEditor.vue` + `commitEdit*`   | usable     | 富文本编辑                |
| `scroll.js`                 | 滚动                   | `setScroll` + wheel                | usable     |                      |
| `refresh.js`                | 刷新网格                 | `requestPaint`                     | usable     |                      |
| `getdata.js` / `setdata.js` | 读写单元格                | `model/sheet.ts`                   | usable     |                      |
| `json.js`                   | JSON 处理              | `io/lucky-json.ts`                 | usable     | extras 大量只透传         |
| `extend.js`                 | 行列扩展时维护 merge/border | `sheet` shiftRows/Cols             | usable     | borderInfo 随行列移位不完整  |
| `createsheet.js`            | 建表                   | `workbook.addSheet`                | usable     |                      |
| `createdom.js`              | 创建 DOM 外壳            | Vue 组件树                            | usable     |                      |
| `cleargridelement.js`       | 清覆盖层                 | 编辑结束隐藏 input                       | skeleton   |                      |
| `sort.js`                   | 排序算法                 | —                                  | none       |                      |
| `validate.js`               | 校验                   | —                                  | none       |                      |
| `dynamicArray.js`           | 动态数组                 | —                                  | none       |                      |
| `datecontroll.js`           | 日期                   | format 日期预设部分                      | skeleton   |                      |
| `getRowlen.js`              | 自适应行高                | —                                  | none       |                      |
| `rhchInit.js`               | 行列头初始化               | renderer 内联                        | usable     |                      |
| `count.js`                  | 计数统计栏                | —                                  | none       |                      |
| `analysis.js`               | 分析相关                 | —                                  | none       |                      |
| `array.js`                  | 数组工具                 | —                                  | none（按需内联） |                      |
| `func_methods.js`           | 公式辅助                 | `formula/functions.ts` 内联          | skeleton   |                      |
| `method.js`                 | 杂项方法                 | —                                  | skeleton   |                      |
| `browser.js`                | 浏览器探测                | —                                  | none       |                      |
| `loading.js` / `tooltip.js` | Loading / Tooltip    | —                                  | none       |                      |
| `cursorPos.js`              | 光标                   | 原生 input                           | skeleton   |                      |


---

## 3. function/ + 公式


| 原位置                                         | 新位置                         | 状态       |
| ------------------------------------------- | --------------------------- | -------- |
| `function/functionImplementation.js` 等（374） | `core/formula/functions.ts` | skeleton |


已实现 builtins（约 22）：  
`SUM` `AVERAGE` `COUNT` `COUNTA` `MAX` `MIN`  
`IF` `AND` `OR` `NOT`  
`ROUND` `ABS`  
`LEN` `TRIM` `CONCAT` `LEFT` `RIGHT`  
`VLOOKUP` `INDEX` `MATCH`  
`TODAY` `NOW`

未实现：其余 ~350（含大量统计/财务/工程/中文身份证等业务函数）。可选外接 HyperFormula（评估 ADR-3）。

---

## 4. store / methods / locale / plugins


| 原位置                        | 新位置                              | 状态       | 说明                 |
| -------------------------- | -------------------------------- | -------- | ------------------ |
| `store/index.js`           | `model/workbook.ts` + `sheet.ts` | usable   | **刻意废除全局单例**；多实例可行 |
| `methods/get.js` `set.js`  | engine / sheet API               | skeleton |                    |
| `locale/*`                 | `LuckySheet` `lang` prop 占位      | skeleton | 无完整 i18n 词条        |
| `expendPlugins/chart`      | —                                | none     |                    |
| `expendPlugins/exportXlsx` | —                                | none     |                    |
| `expendPlugins/print`      | —                                | none     |                    |
| `css/*`                    | 组件 scoped CSS                    | skeleton | 无完整主题/icon sprite  |
| `demoData/*`               | `fixtures/sheet-mini.json` 等     | skeleton |                    |


---

## 5. 工具栏细项（对照原版 locale toolbar）


| 原版能力          | 状态       | 备注                                   |
| ------------- | -------- | ------------------------------------ |
| 撤销/重做         | usable   |                                      |
| 格式刷           | none     |                                      |
| 货币/百分比/数字增减小数 | skeleton | 有 Currency/Percent/Number 预设，无增减小数按钮 |
| 更多格式          | skeleton |                                      |
| 字体            | none     |                                      |
| 字号            | usable   |                                      |
| 粗体/斜体         | usable   | 可切换                                  |
| 删除线/下划线       | none     |                                      |
| 文本色/填充色       | usable   | 原生 color input                       |
| 边框            | usable   | all / outside / none                 |
| 合并            | usable   | 缺合并类型菜单                              |
| 水平/垂直对齐       | usable   |                                      |
| 自动换行/旋转       | none     |                                      |
| 冻结            | usable   |                                      |
| 排序和筛选         | skeleton | 仅 filter API                         |
| 查找替换          | usable   |                                      |
| 自动求和/函数       | none     |                                      |
| 条件格式          | none     |                                      |
| 批注            | none     |                                      |
| 截图/分享等        | none     |                                      |


---

## 6. 交互对拍清单（来自 handler/keyboard，高优先级）

这些不对应单一「功能模块」，但决定「像不像表格」：


| #   | 行为                   | 状态                      | 位置                              |
| --- | -------------------- | ----------------------- | ------------------------------- |
| 1   | 单击选中单元格              | usable                  | GridCanvas                      |
| 2   | 拖拽选区                 | usable                  | GridCanvas                      |
| 3   | 名称框显示 `A1` / `A1:B3` | usable                  | `selectionToLabel` + FormulaBar |
| 4   | 左上角全选                | usable                  | `hitCorner` + `selectAll`       |
| 5   | 编辑中点击其他格：提交并改选       | usable                  | `commitEditAndSelect`           |
| 6   | 行头点击选整行              | usable                  | `hitRowHeader` + `selectRow`    |
| 7   | 列头点击选整列              | usable                  | `hitColHeader` + `selectColumn` |
| 8   | Shift 扩展选区           | usable                  | `extendRange` / `selectAt({shift})` |
| 9   | Ctrl 多选区             | usable                  | `selectAt({ctrl})` + 多块绘制     |
| 10  | 双击进入编辑               | usable                  |                                 |
| 11  | 键入字符进入编辑             | usable                  | pendingChar                     |
| 12  | Enter 提交并下移          | skeleton                | Enter 仅提交，未必下移                  |
| 13  | Tab 提交并右移            | none                    |                                 |
| 14  | Esc 取消编辑             | usable                  |                                 |
| 15  | 方向键移动选区              | usable                  | Shift+方向键扩展；编辑态下通常应退出或移动引用 |
| 16  | Ctrl+C/X/V           | usable                  |                                 |
| 17  | Ctrl+Z/Y             | usable                  |                                 |
| 18  | Ctrl+A 全选            | usable                  | GridCanvas 绑定 `selectAll`      |
| 19  | Delete 清空            | usable                  |                                 |
| 20  | 右键菜单                 | none                    |                                 |
| 21  | 填充柄拖拽                | usable                  |                                 |
| 22  | 行列边缘调宽高              | usable                  |                                 |
| 23  | 冻结后滚动分带              | usable                  |                                 |
| 24  | 公式栏编辑同步              | usable                  |                                 |


---

## 7. compat API（对照 `global/api.js`）


| API 组  | 代表函数                                            | 状态                            |
| ------ | ----------------------------------------------- | ----------------------------- |
| 生命周期   | `create` `destroy`                              | usable（compat）                |
| 单元格    | `getCellValue` `setCellValue`                   | usable（薄）                     |
| 清除/删除格 | `clearCell` `deleteCell`                        | none                          |
| 格式     | `setCellFormat` …                               | skeleton（走 engine 样式，非同名 API） |
| 查找替换   | `find` `replace`                                | skeleton（引擎有，compat 未挂）       |
| 冻结全家桶  | `frozenFirstRow` 等                              | skeleton（有 `setFreeze`）       |
| 行列     | `insertRow` `deleteColumn` `hideRow` …          | skeleton / none（隐藏无）          |
| 选区     | `getRange` `setRangeValue` `setRangeMerge` …    | skeleton / none               |
| 排序筛选   | `setRangeSort` `setRangeFilter`                 | none / skeleton               |
| 条件格式   | `setRangeConditionalFormat*`                    | none                          |
| Sheet  | `setSheetAdd` `setSheetDelete` `setSheetName` … | skeleton（引擎有增删改名）             |
| 配置/刷新  | `getConfig` `refresh` `scroll`                  | skeleton                      |
| 校验/图   | `setDataVerification` `insertImage`             | none                          |
| 协同     | `closeWebsocket`                                | none                          |
| 其它     | `toJson` `changLang` `pagerInit` …              | none / skeleton               |


完整 109 个函数的逐条勾选可在后续把 `api.js` export 列表贴进附录；当前策略是 **Vue/TS 新 API 优先，compat 按需加**。

---

## 8. 建议补齐顺序（基于本表）

1. **交互对拍 §6**：行/列头选中、Shift、Enter/Tab 导航、Ctrl+A、右键菜单骨架
2. **筛选 UI + 排序**（`filter.js` / `orderBy.js`）
3. **数据校验 + 条件格式**（常用业务）
4. **公式扩到 50–100 或接 HyperFormula**
5. **compat 按业务需要挂 API**
6. 对等大件：透视 / 图表 / 批注 / 保护 / 图片 / xlsx / 协同

---

## 9. 维护约定

- 每完成一项：更新对应行的**状态**与**新实现位置**  
- 交互类优先改 §6，不要只改「有模块文件」  
- 不要为对齐原路径而重排 `packages/` 目录（见评估：架构重写不可逐行对照）

---

## 附录：本项目源码索引（便于反向查找）

```
packages/core/src/
  engine.ts              # 对外引擎门面
  command/{types,bus}.ts
  model/{workbook,sheet,cell,cell-key}.ts
  selection/range.ts     # normalize / extend / overlap / headers
  render/canvas-renderer.ts
  hit/location.ts
  clipboard/clipboard.ts
  clipboard/serialize.ts
  clipboard/serialize.ts
  border/borders.ts
  find/find-replace.ts
  format/number-format.ts
  formula/{parser,evaluator,functions}.ts
  io/lucky-json.ts
packages/vue/src/components/
  LuckySheet.vue GridCanvas.vue CellEditor.vue
  FormulaBar.vue Toolbar.vue SheetBar.vue FindReplaceDialog.vue
packages/compat/src/index.ts
```

