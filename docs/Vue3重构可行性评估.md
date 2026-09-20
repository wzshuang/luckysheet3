# Luckysheet 用 Vue 3 彻底重构：可行性评估

- 源码：`D:\dev\git\github.com\Luckysheet`
- 版本：2.1.13
- 统计时点：2026-09-20
- 口径：不含 `node_modules` / `demoData` / 压缩插件
- 目标工作区：`D:\dev\git\github.com\luckysheet3`（评估时为空目录，属于全新实现，不是渐进迁移）

## 1. 结论

**条件可行，但不能按字面「彻底 Vue 化」。**

Vue 3 适合重写外壳（工具栏、公式栏、Sheet 栏、对话框、右键菜单），不适合承载网格本身。单元格若做成 Vue 组件树，万级单元格会拖垮主线程。

正确路径是：

- TypeScript、框架无关的引擎（Canvas 视口绘制）
- Vue 3 外壳（chrome UI + 组件 API）

原仓库 README 已声明 **Luckysheet 停止维护**，并指向 [Univer](https://github.com/dream-num/univer/)。若目标是尽快有一张能用的在线表格，不应从这份源码翻译起；若目标是继续拥有 Luckysheet 协议与 Vue 优先 API，再走自研引擎 + Vue 外壳。

| 项 | 规模 |
| --- | --- |
| `src` 行数 | 16.8 万行 / 111 文件 |
| jQuery DOM 调用 | 4,539 处 `$()` / `jQuery` |
| 内置公式实现 | 374 个 |
| 公开 API（`api.js`） | 109 个 `export function` |
| 自动化测试 | 0 个 test/spec |

## 2. 为什么不能把网格做成 Vue 组件

原项目的绘制入口在 `src/global/draw.js`：用一张 Canvas 按视口绘制行头、列头和单元格，而不是生成 DOM 单元格。`Store` 是全局单例，`handler.js` 用 jQuery 绑鼠标 / 滚轮 / 选区。这是电子表格能滚得动的原因，也是和 Vue 响应式模型冲突的地方。

| 层级 | 原实现 | Vue 3 是否适合 | 重构策略 |
| --- | --- | --- | --- |
| 外壳 UI | `constant.js` 字符串模板 + jQuery 事件 | 非常适合 | 重写成 Vue 组件 + Pinia / provide |
| 对话框 / 菜单 | menuButton、筛选、校验、透视配置 | 适合 | Teleport + 受控组件 |
| 网格绘制 | Canvas 2D 视口绘制（`draw.js` 约 2,300 行） | 不适合 | TS 引擎，Vue 只挂 canvas 节点 |
| 选区 / 键盘 / 冻结 | handler、keyboard、freezen 强耦合 Store | 部分适合 | 引擎命令，Vue 只消费状态快照 |
| 公式引擎 | `formula.js` + 374 个函数实现，约 3.9 万行 | 无关 | 独立包，可用 Worker 重算 |

## 3. 三条路径

「彻底重构」容易理解成把 jQuery 页面翻译成 `.vue` 文件。那是工作量最大、收益最差的一条。

| 路径 | 做法 | 工期（3 人） | 风险 | 建议 |
| --- | --- | --- | --- | --- |
| **A. 引擎 + Vue 外壳** | 自研 TS Workbook / Canvas / Formula，Vue 3 只做 chrome 与组件 API | 约 18 个月到功能对等 | 中：公式与透视仍重 | **要自有品牌库时推荐** |
| B. 全量 Vue 化网格 | 每个单元格 / 行头做成 VNode，用虚拟列表模拟 Excel | 看似更快，性能墙更早出现 | 高：滚动、冻结、合并、溢出文字都会回退 | **否决** |
| C. 不重写引擎 | 接入 Univer（官方后继）或 FortuneSheet，外面包 Vue 3 | 数周到数月可上线 | 中：UI 框架与数据协议不完全可控 | **目标是产品而非自研引擎时首选** |

### 推荐架构（路径 A）

```
Vue 3 Host（组件实例 / provide）
├── Chrome UI（工具栏 / 对话框）──► Command Bus（undo / 协同）
└── Workbook Engine（框架无关 TS）
    ├── Canvas Renderer（视口绘制）
    ├── Formula（解析 / 重算）
    ├── Sheet Model（稀疏单元格）
    └── Command Bus
```

约束：

- Vue Host 持有引擎实例
- Chrome 只发命令
- Renderer / Formula / Model **不依赖 Vue**
- Renderer **零** `vue` import

## 4. 原项目约束（决定工期的不是 Vue）

### 4.1 技术债

| 项 | 现状 |
| --- | --- |
| 运行时 | jQuery 2.2.4 + jQuery UI + Gulp |
| 状态 | 全局 Store，约 4,000+ 处直接读写 |
| DOM | 4,539 处 `$()` / jQuery，无法按文件渐进替换 |
| 公式 | 曾依赖 `window` + `new Function` 执行 |
| 实例 | 单例 `create()`，不支持多表格同页 |
| 测试 | 无 `*.test` / `*.spec` |
| 类型 | 纯 JS，无 TypeScript |

jQuery 和全局 Store 缠在一起，**不能按文件渐进改成 Vue**。能做的是按命令重写引擎，外壳另起。

### 4.2 必须保住的能力

| 模块 | 规模 |
| --- | --- |
| 公开 API | `api.js` 5,854 行 / 109 个 export |
| 交互 | `handler.js` 5,427 行 |
| 工具栏菜单 | `menuButton.js` 4,724 行 |
| 条件格式 | 3,525 行 |
| 透视表 | 3,331 行 |
| 协同 | `server.js` WebSocket + 操作日志 |
| 样式 | `luckysheet-core.css` 6,341 行 |

### 4.3 源码构成

| 目录 | 行数 | 说明 |
| --- | --- | --- |
| controllers | 59,105 | UI 与交互，jQuery 最密集 |
| function | 39,411 | 公式实现与描述 |
| locale | 28,716 | 多语言 |
| global | 28,621 | 绘制、公式解析、API、格式 |
| css | 7,788 | 样式 |
| 其余 | 4,218 | utils / store / methods / plugins 等 |
| **合计** | **167,859** | `src` 统计 |

## 5. 工作量（路径 A）

口径：人月 MVP 10 / 可用版 24 / 功能对等 54，再按编制折算日历月。含熟悉原协议与补测试，**不含** Excel 导入导出插件与打印。

| 编制 | MVP | 可用版 | 功能对等 |
| --- | --- | --- | --- |
| 2 人 | 5 个月 | 12 个月 | 27 个月 |
| 3 人 | 4 个月 | 8 个月 | 18 个月 |
| 5 人 | 2 个月 | 5 个月 | 11 个月 |

| 阶段 | 范围 | 人月 |
| --- | --- | --- |
| MVP | 打开 Lucky JSON、视口绘制、编辑、选区、撤销、基础格式、约 20 个公式、Vue 组件 API | 10 |
| 可用版 | 合并 / 冻结 / 筛选 / 查找替换 / 数据校验 / 100+ 公式、多实例、导入原 data 协议 | 24 |
| 对等 | 374 公式、透视、图表、批注、保护、图片、协同、公开 API 兼容层 | 54 |

## 6. 非功能要求（重构必须先定）

| 类别 | 建议目标 | 对 Vue 的含义 |
| --- | --- | --- |
| 性能 | 视口滚动稳定 60fps；10 万单元格打开 &lt; 3s | 网格禁止走 VDOM |
| 规模 | 单表至少 20 万单元格稀疏存储 | Model 用 Map / 列式，不 reactive 每个 cell |
| 实例 | 同页多个表格 | 废除全局 Store，引擎 `new` 出来再 provide |
| 兼容 | 能读原 `luckysheetfile` JSON | 单独写 adapter，不要让 Vue 组件长得像旧 Store |
| 安全 | 公式禁止 `new Function` / `eval` | 自研解析器或 HyperFormula |
| 可测 | 公式与命令有单测，绘制有快照 / 对拍 | 引擎与 Vue 分层后才测得动 |

## 7. 风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 把网格 Vue 化 | 产品不可用 | 架构门禁：Renderer 零 Vue import |
| 无测试对拍 | 行为回归看不见 | 先冻结一批 demo sheet 做 golden file |
| 374 公式 + 透视 / 图表 | 对等遥遥无期 | MVP 砍范围；公式可接 HyperFormula |
| 协同 OT 协议 | 与旧服务端不兼容 | 先单机；协同作为独立包 |
| 官方已停更 | 社区与招聘预期变化 | 对内讲清：这是新引擎，不是 patch Luckysheet |
| API 108+ 表面兼容 | 包袱巨大 | Vue 组件 API 全新；旧 API 做可选 compat |

## 8. 关键决策（ADR 草案）

### ADR-1 引擎与 Vue 解耦（采用）

WorkbookEngine 纯 TS，不 `import vue`。Vue 3 通过 `createLuckySheet(el, options)` 或 `<LuckySheet />` 持有实例。渲染用 Canvas，覆盖层（选区框、编辑器）可用少量绝对定位 DOM，仍由引擎算坐标。

### ADR-2 不要翻译 jQuery，要按命令重写（采用）

4,539 处 jQuery 与全局 Store 无法「一个文件一个文件改成 Vue」。交互改为 Command（`setCell`、`merge`、`freeze`），Chrome 只 dispatch。这才能做 undo 与协同。

### ADR-3 公式引擎可外购（待定）

自研 374 函数约 2 万行且质量参差（含身份证、业务函数）。可用 HyperFormula / Univer Formula 做计算核，自研只保留 Lucky 函数名映射。这能砍掉对等阶段大约三分之一工期。

### ADR-4 旧 API 兼容作为可选层（采用）

`luckysheet.create` / `getCellValue` 这 109 个 API 绑死了 jQuery 时代的时序。新库以 Vue 组件与 TS 方法为正式 API；compat 包按需提供，避免第一天就承诺 100% 行为兼容。

## 9. 建议的下一步

先确认目标是「自研 Vue 表格库」还是「业务里要有一张能用的表」：

- 前者：启动路径 A 的 MVP（引擎骨架 + 最小 Vue 外壳 + 20 个公式 + Lucky JSON 读取）
- 后者：评估 Univer / FortuneSheet，不必从这份源码翻译

开工前还需确认：**第一期要不要兼容原 `luckysheetfile` JSON 与旧协同协议。**
