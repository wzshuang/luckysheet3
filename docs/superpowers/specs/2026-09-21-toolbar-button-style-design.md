# 工具栏按钮样式对齐原版

- 日期：2026-09-21
- 状态：已批准，待实现
- 范围：仅工具栏**按钮外观**（图标、尺寸、hover/选中、分组顺序）
- 对照：Luckysheet 2.1.13 `src/controllers/toolbar.js` + `src/css/luckysheet-core.css` 工具栏段 + `src/assets/iconfont/`

## 1. 目标

把 luckysheet3 工具栏从「白底灰边文字按钮」拉到原版观感：26×26 透明底图标按钮、浅灰 hover、原版 iconfont。

成功标准（playground 对照原版肉眼即可）：

- 按钮是图标，不再显示 Undo / B / Left 等英文标签
- hover / 按下 / 粗体选中为浅灰叠加，不是蓝底描边
- 文字色、填充有底部色条和右侧箭头；点击打开**系统取色器**，无自定义色板
- 字号、数字格式收起态像原版 combo；展开仍是浏览器原生 `<select>`
- 当前已有工具栏功能全部保留，只换皮和重排

## 2. 非目标（本轮不做）

- 下拉菜单、弹出面板、色板、边框菜单、合并类型菜单、冻结菜单
- 原版「更多」溢出按钮（`#luckysheet-icon-morebtn`）
- 公式栏、Sheet 栏、查找替换对话框样式
- 补齐原版有而本项目没有的按钮（下划线、删除线、字体族、货币/百分比独立按钮、小数位增减等）
- 不改 `@luckysheet3/core` 命令与行为
- 不引入原版 `luckysheet-core.css` 全文或原版多层 `outer-box/inner-box` DOM
- 不做像素级截图回归

## 3. 已确认决策

| 项 | 选择 |
|---|---|
| 图标 | 拷贝原版 `iconfont-luckysheet`，文字只留在 `title` |
| 按钮集合 | 现有功能全留，按原版分组重排；对不上的插在邻近组 |
| 拆分按钮 | 只给文字色、填充；左右点同一件事（系统取色器） |
| 对齐/边框/合并/冻结 | 继续多颗独立图标，不画箭头 |
| 字号/格式 | 收起态做成 combo 外观，展开用原生下拉 |
| 实现路径 | 扁平 Vue 按钮 + 原版 iconfont + 复刻 token（不移植原版 CSS 海洋） |

## 4. 架构

行为仍全部留在现有 `Toolbar.vue`。新增的是资源和展示层。

```
packages/vue/src/
  assets/iconfont/iconfont.css    # 从原版拷贝（MIT），含内嵌 woff2
  styles/toolbar.css              # ls3-toolbar token + 引入 iconfont
  components/ToolbarButton.vue    # 普通图标按钮
  components/Toolbar.vue          # 编排、拆分色按钮、combo、engine 绑定
  index.ts                        # import "./styles/toolbar.css"
```

- `@font-face` 与 `.iconfont-luckysheet` 必须全局，不能写在 scoped 里
- `toolbar.css` 选择器全部挂在 `.ls3-toolbar` 下（iconfont 类名除外），避免污染宿主页
- Vite 已把组件 CSS 打进 `luckysheet3-vue.css`；入口再 import `toolbar.css`，保证走 slot 替换工具栏时字体仍可用，且默认工具栏一定带上样式

### 4.1 ToolbarButton

职责：一颗普通图标按钮。

用法：`<ToolbarButton icon="jiacu" title="粗体" :active="isBold" :disabled="..." @click="..." />`

- 渲染 `<button type="button">` + `<i class="iconfont-luckysheet luckysheet-iconfont-{icon}" aria-hidden="true">`
- `icon` 只写 glyph 短名（如 `jiacu`），组件拼 `luckysheet-iconfont-` 前缀
- `active` → 选中态 class；`disabled` 透传原生 disabled
- 无默认 slot 文字

依赖：仅 `toolbar.css` + iconfont。不读 engine。

### 4.2 Toolbar.vue 内联的两类控件

出现次数各为 2，不另拆组件。

**拆分色按钮**（文字色 / 填充）：

- 外层 `.ls3-toolbar__split`，内含左半图标按钮、右半箭头按钮
- 底部色条绑当前 `fontColor` / `fillColor`
- 隐藏的 `<input type="color">` 绝对定位铺满整组（含左半图标与右半箭头），左右点击都打开同一个系统取色器
- `input` 的 `value` 与现有 `onFontColor` / `onFillColor` 相同

**Combo**（字号 / 数字格式）：

- 外层 `.ls3-toolbar__combo`，可见层显示当前值 + `luckysheet-iconfont-xiayige`
- 原生 `<select>` `appearance: none` 铺在上面，展开列表保持浏览器默认
- 字号：`FONT_SIZES` 不变；格式：`FORMAT_PRESETS` 不变

## 5. 布局顺序与图标

`title` 使用原版中文（`lang` 默认 `zh`）。组间用分隔线。

| 顺序 | 组 | 控件 | glyph 短名 | title |
|---|---|---|---|---|
| 1 | 历史 | 撤销 | `qianjin` | 撤销 |
| | | 重做 | `houtui` | 重做 |
| | | 格式刷 | `geshishua` | 格式刷（双击可连续） |
| 2 | 剪贴（额外） | 复制 | `bianji2` | 复制 |
| | | 剪切 | `caijian` | 剪切 |
| | | 粘贴 | `bianji` | 粘贴 |
| 3 | 数字格式 | 格式 combo | 当前预设 label + `xiayige` | 数字格式 |
| | | 清除格式 | `qingchuyangshi` | 清除格式 |
| 4 | 字体 | 字号 combo | 当前数字 + `xiayige` | 字号 |
| 5 | 字体样式 | 粗体 | `jiacu` | 粗体 |
| | | 斜体 | `wenbenqingxie1` | 斜体 |
| | | 文字色拆分 | `wenbenyanse` + `xiayige` | 文字颜色 |
| 6 | 单元格 | 填充拆分 | `tianchong` + `xiayige` | 填充颜色 |
| | | 全边框 | `quanjiabiankuang` | 所有边框 |
| | | 外边框 | `sizhoujiabiankuang` | 外边框 |
| | | 无边框 | `wubiankuang` | 无边框 |
| | | 合并 | `hebing` | 合并单元格 |
| | | 取消合并 | `quxiaohebing` | 取消合并 |
| 7 | 对齐 | 左 / 中 / 右 | `wenbenzuoduiqi` / `wenbenjuzhongduiqi` / `wenbenyouduiqi` | 左对齐 / 居中 / 右对齐 |
| | | 上 / 中 / 下 | `dingbuduiqi` / `shuipingduiqi` / `dibuduiqi` | 顶端对齐 / 垂直居中 / 底端对齐 |
| 8 | 行列（额外） | 插行 / 删行 | `hang` / `jian1` | 插入行 / 删除行 |
| | | 插列 / 删列 | `lie` / `yichu1` | 插入列 / 删除列 |
| 9 | 冻结 | 冻行 / 冻列 / 冻此处 | `dongjie1` / `dongjie` / `dongjie1` | 冻结首行 / 冻结首列 / 冻结至此 |
| | | 取消冻结 | `qingchu` | 取消冻结 |
| 10 | 查找 | 查找 | `sousuo` | 查找替换 |

原版字库没有复制、粘贴、垂直居中的专用名，上表用最接近 glyph。实现后在 playground 目视：若某颗明显错图，只许换成**同一 iconfont 里的另一个 class**，不新画 SVG。

## 6. 视觉 token

对照原版 `.luckysheet-wa-editor` / `.luckysheet-toolbar-button`，写进 `toolbar.css`。

**容器 `.ls3-toolbar`**

- `display: flex; flex-wrap: wrap; align-items: center`
- 背景 `#fafafc`，左内边距 `15px`，上下约 `5px` / `3px`
- 底边 `1px solid #d4d4d4`
- 允许换行：本轮不做「更多」溢出菜单，避免按钮被裁切

**图标按钮**

- 高 `26px`，最小宽 `26px`，圆角 `2px`
- 背景透明，边框 `1px solid transparent`，颜色 `#333`
- 图标字体 `24px`，盒 `26×26`
- hover：`background rgba(0,0,0,.06)`
- 按下 / `:active`：`background rgba(0,0,0,.12)`
- 选中（`.is-on`，粗体/斜体/格式刷）：与 hover 同色，**不用**蓝底 `#e6f4ff`
- 禁用：`opacity: .4`，无 hover，`cursor: default`
- `:focus-visible`：仅 hover 底，不画系统描边
- 去掉当前白底、`#d9d9d9` 边、`4px` 圆角

**拆分色按钮**

- 左半去掉右侧圆角，右半去掉左侧圆角；右半 `min-width` 约 `14px`
- 右半 hover 时左缝 `rgba(0,0,0,.12)`
- 色条：高 `3px`、宽约 `55%`、水平居中偏下，颜色等于当前 `fc` / `bg`

**Combo**

- 高 `26px`，透明底，hover 与按钮相同
- 字号数字区宽约 `22px`，`font-size: 11px`，`font-weight: bold`
- 格式标题宽约 `55px`，溢出省略
- 箭头 `luckysheet-iconfont-xiayige`，字号 `12px`

**分隔线 `.ls3-toolbar__sep`**

- 高 `20px`，`border-left: 1px solid #e0e0e0`，左右 `1px` 边距

## 7. 交互（行为不变）

| 控件 | 仍然调用 |
|---|---|
| 撤销 / 重做 | `engine.undo()` / `redo()`，深度为 0 时 disabled |
| 格式刷 | 现有单击一次 / 双击连续 / 再点取消 |
| 复制剪切粘贴 | 现有 `onCopy` / `onCut` / `onPaste` |
| 粗体斜体 | `toggleStyleOnSelection('bl'\|'it')` |
| 字号 / 颜色 / 格式 | `applyStyleToSelection` / `applyFormatToSelection` |
| 对齐 / 边框 / 合并 / 行列 / 冻结 / 查找 | 与现网相同 |

颜色拆分不打开自定义面板：左右都启动同一个系统 `<input type="color">`。该控件的 UI 随浏览器，本轮不统一。

## 8. 边界

- iconfont 加载失败：按钮可点，图标可能是空白方框，不抛错、不降级回文字标签
- 部分环境没有系统取色器：颜色按钮仍在，取色可能无效；不做 polyfill
- 窄宽度：工具栏换行，不出现「更多」
- 复制/粘贴图标靠 `title` 补语义，不为此增加可见文字
- 宿主用 slot 换掉默认工具栏：仍会加载 `toolbar.css` + iconfont（入口 import）；slot 内容不强制用这些 class

## 9. 测试与验收

无新增 core 单测（不改引擎）。

- `pnpm --filter @luckysheet3/vue typecheck` 通过
- playground 打开默认表，按第 1 节成功标准目视
- 抽测：撤销禁用态、粗体选中浅灰、格式刷 `is-on`、改文字色/填充后色条变化、改字号/格式仍写入单元格
- 不测下拉列表皮肤、不测弹层、不做截图像素 CI

## 10. 文件改动清单

| 文件 | 动作 |
|---|---|
| `packages/vue/src/assets/iconfont/iconfont.css` | 新增，拷贝自原版（文件头注明来源与 MIT） |
| `packages/vue/src/styles/toolbar.css` | 新增 |
| `packages/vue/src/components/ToolbarButton.vue` | 新增 |
| `packages/vue/src/components/Toolbar.vue` | 改 markup/样式绑定；逻辑函数保留 |
| `packages/vue/src/index.ts` | `import "./styles/toolbar.css"` |
| `docs/FEATURE_MAP.md` | 工具栏行备注「按钮外观对齐原版；下拉/弹层仍无」 |

Playground 不必为这次单独改页面，除非默认页工具栏被 slot 覆盖（当前没有）。
