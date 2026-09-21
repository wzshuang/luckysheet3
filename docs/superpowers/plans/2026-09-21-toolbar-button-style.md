# 工具栏按钮样式对齐原版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 luckysheet3 工具栏按钮换成原版 iconfont + 26×26 透明底浅灰 hover，现有功能全留并按原版分组重排。

**Architecture:** 从原版拷贝 iconfont（只保留内嵌 woff2，去掉会让 Vite 解析失败的本地字体 URL）。用 `ls3-toolbar-*` 复刻 token。普通按钮抽 `ToolbarButton.vue`；文字色/填充拆分与字号/格式 combo 写在 `Toolbar.vue`。不改 core。

**Tech Stack:** Vue 3 SFC、Vite lib CSS、原版 iconfont-luckysheet、Node 内置 `node:test`（不给 vue 包加 vitest / test-utils）。

**Spec:** `docs/superpowers/specs/2026-09-21-toolbar-button-style-design.md`

## Global Constraints

- 不改 `@luckysheet3/core` 命令与行为
- 不引入原版 `luckysheet-core.css`，不用多层 `outer-box/inner-box` DOM
- 不做下拉菜单、自定义色板、弹层、「更多」溢出按钮
- 不补原版有而当前没有的按钮（下划线、删除线、字体族等）
- `title` 用中文；可见区域不放 Undo / B / Left 这类文字
- 拆分外观只给文字色、填充；左右点击同一隐藏 `input[type=color]`
- iconfont 来源 Luckysheet 2.1.13，MIT；文件头必须注明
- 提交信息用中文 `feat:` / `docs:` 前缀；每任务末尾的 commit 步骤按用户规则执行（用户未要求提交则跳过）
- 原版路径：`D:\dev\git\github.com\Luckysheet`

## File Map

| 文件 | 职责 |
|---|---|
| `packages/vue/src/assets/iconfont/iconfont.css` | 原版字形 + 仅 woff2 data URI 的 `@font-face` |
| `packages/vue/src/styles/toolbar.css` | `@import` iconfont；`.ls3-toolbar` token |
| `packages/vue/src/components/ToolbarButton.vue` | 普通图标按钮 |
| `packages/vue/src/components/Toolbar.vue` | 编排、拆分、combo、现有 engine 绑定 |
| `packages/vue/src/index.ts` | `import "./styles/toolbar.css"` |
| `packages/vue/tests/toolbar-style.test.mjs` | 检查 glyph / token / markup |
| `packages/vue/package.json` | 增加 `test` script |
| `docs/FEATURE_MAP.md` | 工具栏备注 |

---

### Task 1: 拷贝并裁剪 iconfont

**Files:**
- Create: `packages/vue/src/assets/iconfont/iconfont.css`
- Create: `packages/vue/tests/toolbar-style.test.mjs`
- Modify: `packages/vue/package.json`（加 `"test": "node --test tests/toolbar-style.test.mjs"`）

**Interfaces:**
- Produces: `packages/vue/src/assets/iconfont/iconfont.css` 含 `font-family: "iconfont-luckysheet"`、class `.iconfont-luckysheet`、以及下列 glyph：`qianjin` `houtui` `geshishua` `bianji2` `caijian` `bianji` `xiayige` `qingchuyangshi` `jiacu` `wenbenqingxie1` `wenbenyanse` `tianchong` `quanjiabiankuang` `sizhoujiabiankuang` `wubiankuang` `hebing` `quxiaohebing` `wenbenzuoduiqi` `wenbenjuzhongduiqi` `wenbenyouduiqi` `dingbuduiqi` `shuipingduiqi` `dibuduiqi` `hang` `jian1` `lie` `yichu1` `dongjie1` `dongjie` `qingchu` `sousuo`
- 约束：`@font-face` 的 `src` **只有** `url('data:application/x-font-woff2...')`，不能出现 `iconfont.eot` / `.woff` / `.ttf` / `.svg` 相对路径（否则 Vite build 找不到文件）

- [ ] **Step 1: 写失败测试并加上 test script**

`packages/vue/package.json` 的 `scripts` 改为：

```json
"scripts": {
  "build": "vite build && vue-tsc -p tsconfig.build.json --emitDeclarationOnly",
  "typecheck": "vue-tsc -p tsconfig.json --noEmit",
  "test": "node --test tests/toolbar-style.test.mjs"
}
```

创建 `packages/vue/tests/toolbar-style.test.mjs`：

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconfontPath = path.join(root, "src/assets/iconfont/iconfont.css");

const GLYPHS = [
  "qianjin",
  "houtui",
  "geshishua",
  "bianji2",
  "caijian",
  "bianji",
  "xiayige",
  "qingchuyangshi",
  "jiacu",
  "wenbenqingxie1",
  "wenbenyanse",
  "tianchong",
  "quanjiabiankuang",
  "sizhoujiabiankuang",
  "wubiankuang",
  "hebing",
  "quxiaohebing",
  "wenbenzuoduiqi",
  "wenbenjuzhongduiqi",
  "wenbenyouduiqi",
  "dingbuduiqi",
  "shuipingduiqi",
  "dibuduiqi",
  "hang",
  "jian1",
  "lie",
  "yichu1",
  "dongjie1",
  "dongjie",
  "qingchu",
  "sousuo",
];

describe("iconfont asset", () => {
  it("exists with woff2 data URI only and required glyphs", () => {
    const css = fs.readFileSync(iconfontPath, "utf8");
    assert.match(css, /font-family:\s*"iconfont-luckysheet"/);
    assert.match(css, /data:application\/x-font-woff2/);
    assert.doesNotMatch(css, /url\(['"]iconfont\.(eot|woff|ttf|svg)/);
    for (const name of GLYPHS) {
      assert.match(css, new RegExp(`\\.luckysheet-iconfont-${name}:before`));
    }
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: FAIL，`ENOENT` 读不到 `src/assets/iconfont/iconfont.css`

- [ ] **Step 3: 拷贝并裁剪原版 css**

在仓库根目录执行（一次性 node 脚本，不要把脚本提交进仓库）：

```js
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(
  path.resolve("D:/dev/git/github.com/Luckysheet/src/assets/iconfont/iconfont.css"),
  "utf8",
);
const m = src.match(
  /url\('data:application\/x-font-woff2;charset=utf-8;base64,[A-Za-z0-9+/=]+'\) format\('woff2'\)/,
);
if (!m) throw new Error("woff2 data URI not found");
const withoutFace = src.replace(/@font-face\s*\{[\s\S]*?\}\s*/, "");
const out = `/* Copied from Luckysheet 2.1.13 src/assets/iconfont/iconfont.css
 * License: MIT (see Luckysheet LICENSE)
 * Local eot/woff/ttf/svg URLs removed; woff2 data URI only.
 */
@font-face {
  font-family: "iconfont-luckysheet";
  src: ${m[0]};
}

${withoutFace}`;
const dest = path.resolve("packages/vue/src/assets/iconfont/iconfont.css");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log("wrote", dest, "bytes", out.length);
```

把上面存成临时文件 `packages/vue/scripts/_copy-iconfont.mjs`，运行：

```
node packages/vue/scripts/_copy-iconfont.mjs
```

成功后删除 `packages/vue/scripts/_copy-iconfont.mjs`（以及空的 `scripts/` 目录，若已空）。

- [ ] **Step 4: 再跑测试**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: PASS，`iconfont asset` 1 passing

- [ ] **Step 5: Commit**

```
git add packages/vue/src/assets/iconfont/iconfont.css packages/vue/tests/toolbar-style.test.mjs packages/vue/package.json
git commit -m "feat: 引入原版工具栏 iconfont"
```

---

### Task 2: toolbar.css token + 入口引入

**Files:**
- Create: `packages/vue/src/styles/toolbar.css`
- Modify: `packages/vue/src/index.ts`
- Modify: `packages/vue/tests/toolbar-style.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `../assets/iconfont/iconfont.css`（相对 `styles/`）
- Produces: 全局 `import "./styles/toolbar.css"`；class `.ls3-toolbar` `.ls3-toolbar__btn` `.ls3-toolbar__btn.is-on` `.ls3-toolbar__sep` `.ls3-toolbar__split` `.ls3-toolbar__split-left` `.ls3-toolbar__split-right` `.ls3-toolbar__swatch` `.ls3-toolbar__color-bar` `.ls3-toolbar__color-input` `.ls3-toolbar__combo` `.ls3-toolbar__combo--size` `.ls3-toolbar__combo--format` `.ls3-toolbar__combo-value` `.ls3-toolbar__combo-select` `.ls3-toolbar__icon`

- [ ] **Step 1: 把 token 测试追加进 test 文件**

在 `packages/vue/tests/toolbar-style.test.mjs` 末尾追加：

```js
const toolbarCssPath = path.join(root, "src/styles/toolbar.css");
const indexPath = path.join(root, "src/index.ts");

describe("toolbar.css tokens", () => {
  it("imports iconfont and uses original chrome tokens", () => {
    const css = fs.readFileSync(toolbarCssPath, "utf8");
    const indexSrc = fs.readFileSync(indexPath, "utf8");
    assert.match(indexSrc, /import "\.\/styles\/toolbar\.css"/);
    assert.match(css, /@import "\.\.\/assets\/iconfont\/iconfont\.css"/);
    assert.match(css, /background:\s*#fafafc/);
    assert.match(css, /border-bottom:\s*1px solid #d4d4d4/);
    assert.match(css, /height:\s*26px/);
    assert.match(css, /border-radius:\s*2px/);
    assert.match(css, /rgba\(0,\s*0,\s*0,\s*\.06\)/);
    assert.match(css, /rgba\(0,\s*0,\s*0,\s*\.12\)/);
    assert.doesNotMatch(css, /#e6f4ff/);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: FAIL，读不到 `src/styles/toolbar.css`

- [ ] **Step 3: 写 CSS 并在入口引入**

把 `packages/vue/src/index.ts` **第一行**设为：

```ts
import "./styles/toolbar.css";
export { default as LuckySheet } from "./components/LuckySheet.vue";
export { useLuckySheet, useLuckySheetOptional, LUCKY_ENGINE_KEY } from "./composables/useLuckySheet";
export { useChromeState } from "./composables/useChromeState";
export type { ChromeState } from "./composables/useChromeState";
```

创建 `packages/vue/src/styles/toolbar.css`，全文如下：

```css
@import "../assets/iconfont/iconfont.css";

.ls3-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 5px 0 3px 15px;
  background: #fafafc;
  border-bottom: 1px solid #d4d4d4;
  color: #333;
  box-sizing: border-box;
}

.ls3-toolbar,
.ls3-toolbar * {
  box-sizing: border-box;
}

.ls3-toolbar .iconfont-luckysheet {
  font-size: 24px;
  line-height: 26px;
}

.ls3-toolbar .luckysheet-iconfont-xiayige {
  font-size: 12px;
  line-height: 26px;
}

.ls3-toolbar__btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  min-width: 26px;
  margin: 0 1px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: #333;
  cursor: default;
  outline: none;
}

.ls3-toolbar__btn:hover,
.ls3-toolbar__btn.is-on,
.ls3-toolbar__btn:focus-visible {
  background: rgba(0, 0, 0, 0.06);
  cursor: pointer;
}

.ls3-toolbar__btn:active {
  background: rgba(0, 0, 0, 0.12);
  cursor: pointer;
}

.ls3-toolbar__btn:disabled,
.ls3-toolbar__btn:disabled:hover,
.ls3-toolbar__btn:disabled:active {
  opacity: 0.4;
  background: transparent;
  cursor: default;
}

.ls3-toolbar__icon {
  display: block;
  width: 26px;
  height: 26px;
  text-align: center;
}

.ls3-toolbar__sep {
  width: 0;
  height: 20px;
  margin: 5px 1px;
  border-left: 1px solid #e0e0e0;
}

.ls3-toolbar__split {
  position: relative;
  display: inline-flex;
  height: 26px;
  margin: 0 1px;
}

.ls3-toolbar__split-left,
.ls3-toolbar__split-right {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  border: 1px solid transparent;
  background: transparent;
}

.ls3-toolbar__split-left {
  min-width: 26px;
  border-radius: 2px 0 0 2px;
}

.ls3-toolbar__split-right {
  min-width: 14px;
  padding: 0 2px;
  border-radius: 0 2px 2px 0;
}

.ls3-toolbar__split:hover .ls3-toolbar__split-left,
.ls3-toolbar__split:hover .ls3-toolbar__split-right,
.ls3-toolbar__split:focus-within .ls3-toolbar__split-left,
.ls3-toolbar__split:focus-within .ls3-toolbar__split-right {
  background: rgba(0, 0, 0, 0.06);
}

.ls3-toolbar__split:hover .ls3-toolbar__split-right,
.ls3-toolbar__split:focus-within .ls3-toolbar__split-right {
  border-left-color: rgba(0, 0, 0, 0.12);
}

.ls3-toolbar__swatch {
  position: relative;
  display: block;
  width: 26px;
  height: 26px;
}

.ls3-toolbar__color-bar {
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 2px;
  height: 3px;
  width: 55%;
  margin: 0 auto;
}

.ls3-toolbar__color-input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  opacity: 0;
  cursor: pointer;
}

.ls3-toolbar__combo {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 26px;
  margin: 0 1px;
  padding: 0 4px 0 6px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: #333;
}

.ls3-toolbar__combo:hover,
.ls3-toolbar__combo:focus-within {
  background: rgba(0, 0, 0, 0.06);
}

.ls3-toolbar__combo--size .ls3-toolbar__combo-value {
  width: 22px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.ls3-toolbar__combo--format .ls3-toolbar__combo-value {
  width: 55px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 700;
}

.ls3-toolbar__combo-select {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  opacity: 0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}
```

- [ ] **Step 4: 再跑测试**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: PASS，iconfont + toolbar.css 都过

- [ ] **Step 5: Commit**

```
git add packages/vue/src/styles/toolbar.css packages/vue/src/index.ts packages/vue/tests/toolbar-style.test.mjs
git commit -m "feat: 复刻原版工具栏按钮视觉 token"
```

---

### Task 3: ToolbarButton 组件

**Files:**
- Create: `packages/vue/src/components/ToolbarButton.vue`
- Modify: `packages/vue/tests/toolbar-style.test.mjs`

**Interfaces:**
- Consumes: `.ls3-toolbar__btn` / `.ls3-toolbar__icon`（Task 2）；glyph class `luckysheet-iconfont-${icon}`（Task 1）
- Produces:

```ts
defineProps<{
  icon: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
}>();
```

模板：`<button type="button">` + `<i class="iconfont-luckysheet ls3-toolbar__icon" :class="\`luckysheet-iconfont-${icon}\`">`；`active` 时 button 加 `is-on`；无默认 slot 文字。

- [ ] **Step 1: 写失败测试**

追加到 `packages/vue/tests/toolbar-style.test.mjs`：

```js
const buttonPath = path.join(root, "src/components/ToolbarButton.vue");

describe("ToolbarButton.vue", () => {
  it("renders icon class from short name and has no default text slot", () => {
    const sfc = fs.readFileSync(buttonPath, "utf8");
    assert.match(sfc, /defineProps/);
    assert.match(sfc, /luckysheet-iconfont-\$\{icon\}/);
    assert.match(sfc, /ls3-toolbar__btn/);
    assert.match(sfc, /is-on/);
    assert.match(sfc, /type="button"/);
    assert.doesNotMatch(sfc, /<slot/);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: FAIL，读不到 `ToolbarButton.vue`

- [ ] **Step 3: 写组件**

创建 `packages/vue/src/components/ToolbarButton.vue`，全文：

```vue
<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="ls3-toolbar__btn"
    :class="{ 'is-on': active }"
    :title="title"
    :disabled="disabled"
  >
    <i
      class="iconfont-luckysheet ls3-toolbar__icon"
      :class="`luckysheet-iconfont-${icon}`"
      aria-hidden="true"
    />
  </button>
</template>
```

不要加 `<style>`。

- [ ] **Step 4: 再跑测试 + typecheck**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: PASS

Run: `pnpm --filter @luckysheet3/vue typecheck`

Expected: exit 0（此时 Toolbar 还未引用该组件，也应通过）

- [ ] **Step 5: Commit**

```
git add packages/vue/src/components/ToolbarButton.vue packages/vue/tests/toolbar-style.test.mjs
git commit -m "feat: 增加工具栏图标按钮组件"
```

---

### Task 4: 重排 Toolbar.vue markup

**Files:**
- Modify: `packages/vue/src/components/Toolbar.vue`（保留 `<script>` 里现有函数；加 import 与 `formatLabel`；**删除**底部 `<style scoped>`；替换 `<template>`）
- Modify: `packages/vue/tests/toolbar-style.test.mjs`

**Interfaces:**
- Consumes: `ToolbarButton` 的 `icon` / `title` / `active` / `disabled` / `click`；Task 2 的 split / combo class；现有 `engine.*` 与 `onCopy` `onCut` `onPaste` `onPaintClick` `onFontSize` `onFontColor` `onFillColor` `onFormat`
- Produces: `formatLabel` computed，返回当前 `FORMAT_PRESETS` 的 `label`；模板顺序与 spec §5 一致

**不要改** script 里的 engine 调用实现，只加两处：

1. `import ToolbarButton from "./ToolbarButton.vue";`
2. 在 `isPaintFormatActive` 附近：

```ts
const formatLabel = computed(
  () => FORMAT_PRESETS.find((p) => p.id === formatId.value)?.label ?? "General",
);
```

- [ ] **Step 1: 写失败测试**

追加到 `packages/vue/tests/toolbar-style.test.mjs`：

```js
const toolbarVuePath = path.join(root, "src/components/Toolbar.vue");

describe("Toolbar.vue markup", () => {
  it("uses Chinese titles, original glyphs, split/combo, no english labels", () => {
    const sfc = fs.readFileSync(toolbarVuePath, "utf8");
    assert.match(sfc, /import ToolbarButton from "\.\/ToolbarButton\.vue"/);
    assert.match(sfc, /title="撤销"/);
    assert.match(sfc, /title="查找替换"/);
    assert.match(sfc, /icon="qianjin"/);
    assert.match(sfc, /icon="geshishua"/);
    assert.match(sfc, /ls3-toolbar__split/);
    assert.match(sfc, /ls3-toolbar__combo--size/);
    assert.match(sfc, /ls3-toolbar__combo--format/);
    assert.match(sfc, /luckysheet-iconfont-wenbenyanse/);
    assert.match(sfc, /luckysheet-iconfont-tianchong/);
    assert.doesNotMatch(sfc, />Undo</);
    assert.doesNotMatch(sfc, />Redo</);
    assert.doesNotMatch(sfc, />Left</);
    assert.doesNotMatch(sfc, />Clear Fmt</);
    assert.doesNotMatch(sfc, /<style scoped>/);

    const icons = [...sfc.matchAll(/icon="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(icons, [
      "qianjin",
      "houtui",
      "geshishua",
      "bianji2",
      "caijian",
      "bianji",
      "qingchuyangshi",
      "jiacu",
      "wenbenqingxie1",
      "quanjiabiankuang",
      "sizhoujiabiankuang",
      "wubiankuang",
      "hebing",
      "quxiaohebing",
      "wenbenzuoduiqi",
      "wenbenjuzhongduiqi",
      "wenbenyouduiqi",
      "dingbuduiqi",
      "shuipingduiqi",
      "dibuduiqi",
      "hang",
      "jian1",
      "lie",
      "yichu1",
      "dongjie1",
      "dongjie",
      "dongjie1",
      "qingchu",
      "sousuo",
    ]);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: FAIL（现模板仍是英文文字按钮，对不上 `icon=` 列表）

- [ ] **Step 3: 替换 template，删 scoped style，加 import / formatLabel**

`Toolbar.vue` 的 `<script setup>` 在现有 import 后增加：

```ts
import ToolbarButton from "./ToolbarButton.vue";
```

在 `isPaintFormatActive` 后增加 `formatLabel` computed（见本任务 Interfaces）。

**删除**从 `<style scoped>` 到文件末尾的全部样式。

`<template>` **全文替换为**：

```vue
<template>
  <div class="ls3-toolbar">
    <ToolbarButton icon="qianjin" title="撤销" :disabled="chrome.undoDepth.value <= 0" @click="engine.undo()" />
    <ToolbarButton icon="houtui" title="重做" :disabled="chrome.redoDepth.value <= 0" @click="engine.redo()" />
    <ToolbarButton
      icon="geshishua"
      title="格式刷（双击可连续）"
      :active="isPaintFormatActive"
      @click="onPaintClick"
    />
    <span class="ls3-toolbar__sep" />
    <ToolbarButton icon="bianji2" title="复制" @click="onCopy" />
    <ToolbarButton icon="caijian" title="剪切" @click="onCut" />
    <ToolbarButton icon="bianji" title="粘贴" @click="onPaste" />
    <span class="ls3-toolbar__sep" />
    <div class="ls3-toolbar__combo ls3-toolbar__combo--format" title="数字格式">
      <span class="ls3-toolbar__combo-value">{{ formatLabel }}</span>
      <i class="iconfont-luckysheet luckysheet-iconfont-xiayige" aria-hidden="true" />
      <select class="ls3-toolbar__combo-select" :value="formatId" @change="onFormat">
        <option v-for="p in FORMAT_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </div>
    <ToolbarButton icon="qingchuyangshi" title="清除格式" @click="engine.clearFormatOnSelection()" />
    <span class="ls3-toolbar__sep" />
    <div class="ls3-toolbar__combo ls3-toolbar__combo--size" title="字号">
      <span class="ls3-toolbar__combo-value">{{ fontSize }}</span>
      <i class="iconfont-luckysheet luckysheet-iconfont-xiayige" aria-hidden="true" />
      <select class="ls3-toolbar__combo-select" :value="fontSize" @change="onFontSize">
        <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <span class="ls3-toolbar__sep" />
    <ToolbarButton icon="jiacu" title="粗体" :active="isBold" @click="engine.toggleStyleOnSelection('bl')" />
    <ToolbarButton icon="wenbenqingxie1" title="斜体" :active="isItalic" @click="engine.toggleStyleOnSelection('it')" />
    <div class="ls3-toolbar__split" title="文字颜色">
      <span class="ls3-toolbar__split-left">
        <span class="ls3-toolbar__swatch">
          <i class="iconfont-luckysheet luckysheet-iconfont-wenbenyanse ls3-toolbar__icon" aria-hidden="true" />
          <span class="ls3-toolbar__color-bar" :style="{ backgroundColor: fontColor }" />
        </span>
      </span>
      <span class="ls3-toolbar__split-right">
        <i class="iconfont-luckysheet luckysheet-iconfont-xiayige" aria-hidden="true" />
      </span>
      <input class="ls3-toolbar__color-input" type="color" :value="fontColor" @input="onFontColor" />
    </div>
    <span class="ls3-toolbar__sep" />
    <div class="ls3-toolbar__split" title="填充颜色">
      <span class="ls3-toolbar__split-left">
        <span class="ls3-toolbar__swatch">
          <i class="iconfont-luckysheet luckysheet-iconfont-tianchong ls3-toolbar__icon" aria-hidden="true" />
          <span class="ls3-toolbar__color-bar" :style="{ backgroundColor: fillColor }" />
        </span>
      </span>
      <span class="ls3-toolbar__split-right">
        <i class="iconfont-luckysheet luckysheet-iconfont-xiayige" aria-hidden="true" />
      </span>
      <input class="ls3-toolbar__color-input" type="color" :value="fillColor" @input="onFillColor" />
    </div>
    <ToolbarButton icon="quanjiabiankuang" title="所有边框" @click="engine.applyBordersToSelection('all')" />
    <ToolbarButton icon="sizhoujiabiankuang" title="外边框" @click="engine.applyBordersToSelection('outside')" />
    <ToolbarButton icon="wubiankuang" title="无边框" @click="engine.applyBordersToSelection('none')" />
    <ToolbarButton icon="hebing" title="合并单元格" @click="engine.mergeSelection()" />
    <ToolbarButton icon="quxiaohebing" title="取消合并" @click="engine.unmergeSelection()" />
    <span class="ls3-toolbar__sep" />
    <ToolbarButton icon="wenbenzuoduiqi" title="左对齐" @click="engine.applyStyleToSelection({ ht: 1 })" />
    <ToolbarButton icon="wenbenjuzhongduiqi" title="居中" @click="engine.applyStyleToSelection({ ht: 0 })" />
    <ToolbarButton icon="wenbenyouduiqi" title="右对齐" @click="engine.applyStyleToSelection({ ht: 2 })" />
    <ToolbarButton icon="dingbuduiqi" title="顶端对齐" @click="engine.applyStyleToSelection({ vt: 1 })" />
    <ToolbarButton icon="shuipingduiqi" title="垂直居中" @click="engine.applyStyleToSelection({ vt: 0 })" />
    <ToolbarButton icon="dibuduiqi" title="底端对齐" @click="engine.applyStyleToSelection({ vt: 2 })" />
    <span class="ls3-toolbar__sep" />
    <ToolbarButton icon="hang" title="插入行" @click="engine.insertRowsAtSelection()" />
    <ToolbarButton icon="jian1" title="删除行" @click="engine.deleteRowsAtSelection()" />
    <ToolbarButton icon="lie" title="插入列" @click="engine.insertColsAtSelection()" />
    <ToolbarButton icon="yichu1" title="删除列" @click="engine.deleteColsAtSelection()" />
    <span class="ls3-toolbar__sep" />
    <ToolbarButton icon="dongjie1" title="冻结首行" @click="freezeRow" />
    <ToolbarButton icon="dongjie" title="冻结首列" @click="freezeCol" />
    <ToolbarButton icon="dongjie1" title="冻结至此" @click="engine.freezeSelection()" />
    <ToolbarButton icon="qingchu" title="取消冻结" @click="clearFreeze" />
    <span class="ls3-toolbar__sep" />
    <ToolbarButton icon="sousuo" title="查找替换" @click="showFind = true" />
  </div>
  <FindReplaceDialog v-if="showFind" :engine="engine" @close="showFind = false" />
</template>
```

若目视某颗额外按钮（复制/粘贴/垂直居中）明显错图：只改 `icon` 短名为同一 iconfont 里另一个 class，并同步更新本任务测试里的 `icons` 数组。不要加 SVG。

- [ ] **Step 4: 再跑测试 + typecheck**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: PASS

Run: `pnpm --filter @luckysheet3/vue typecheck`

Expected: exit 0

Run: `pnpm --filter @luckysheet3/core test`

Expected: 全绿（确认没碰 core）

- [ ] **Step 5: Commit**

```
git add packages/vue/src/components/Toolbar.vue packages/vue/tests/toolbar-style.test.mjs
git commit -m "feat: 工具栏改为原版图标按钮并按组重排"
```

---

### Task 5: FEATURE_MAP 与 playground 验收

**Files:**
- Modify: `docs/FEATURE_MAP.md`
- Test: playground 目视（无新单测）

**Interfaces:**
- Consumes: Task 4 的默认工具栏（`LuckySheet.vue` 未用 slot 覆盖 toolbar）
- Produces: FEATURE_MAP 中 toolbar 行备注更新

- [ ] **Step 1: 更新 FEATURE_MAP**

`docs/FEATURE_MAP.md` 第 58 行附近，把 toolbar 行的「主要缺口」从：

`见 §5 工具栏细项`

改为：

`按钮外观已对齐原版 iconfont；下拉/弹层仍无。见 §5 工具栏细项`

同文件 `css/*` 那一行（约第 171 行），把说明从：

`无完整主题/icon sprite`

改为：

`工具栏已引入原版 iconfont；无完整主题。下拉/弹层样式未做`

- [ ] **Step 2: typecheck + vue test 再确认一遍**

Run: `pnpm --filter @luckysheet3/vue test`

Expected: PASS

Run: `pnpm --filter @luckysheet3/vue typecheck`

Expected: exit 0

- [ ] **Step 3: playground 目视**

Run: `pnpm --filter @luckysheet3/playground dev`

打开 playground 默认表，对照 spec §1：

- 工具栏是图标，没有 Undo / B / Left 字样
- hover / 粗体选中是浅灰，不是蓝底
- 文字色、填充有色条和箭头；点击出现系统取色器，没有自定义弹层
- 字号、格式收起像 combo，点开是原生下拉
- 抽测：空历史上撤销禁用；点粗体格子变粗且按钮 `is-on`；格式刷单击/再点取消；改填充色后色条变；改字号后格子字号变；查找仍能打开对话框

窄窗口下工具栏应换行，没有「更多」按钮。

- [ ] **Step 4: Commit**

```
git add docs/FEATURE_MAP.md
git commit -m "docs: 注明工具栏按钮外观已对齐原版"
```

---

## Spec coverage（自检）

| Spec 项 | 任务 |
|---|---|
| 拷贝 iconfont + MIT 头 + 去掉本地字体 URL | Task 1 |
| `toolbar.css` token、容器、hover/选中/禁用、分隔线 | Task 2 |
| 入口 import CSS | Task 2 |
| ToolbarButton | Task 3 |
| 分组顺序、中文 title、拆分色、combo | Task 4 |
| 不改 engine 行为 | Task 4 只改 markup |
| FEATURE_MAP | Task 5 |
| playground 验收 | Task 5 |
| 不做下拉/弹层/更多按钮 | 全局约束，无对应任务（有意） |
