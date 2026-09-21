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
  "xiayige",
  "qingchuyangshi",
  "jiacu",
  "wenbenqingxie1",
  "wenbenshanchuxian",
  "wenbenxiahuaxian",
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
    assert.match(css, /\.ls3-toolbar__menu/);
    assert.match(css, /min-width:\s*120px/);
    assert.match(css, /#efefef/);
    assert.doesNotMatch(css, /#e6f4ff/);
  });
});

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

const toolbarVuePath = path.join(root, "src/components/Toolbar.vue");

describe("Toolbar.vue markup", () => {
  it("uses Chinese titles, original glyphs, split/combo, no english labels", () => {
    const sfc = fs.readFileSync(toolbarVuePath, "utf8");
    assert.match(sfc, /import ToolbarButton from "\.\/ToolbarButton\.vue"/);
    assert.match(sfc, /title="撤销"/);
    assert.match(sfc, /title="查找替换"/);
    assert.match(sfc, /icon="qianjin"/);
    assert.match(sfc, /icon="geshishua"/);
    assert.match(sfc, /ls3-toolbar__split--color/);
    assert.match(sfc, /ls3-toolbar__combo--size/);
    assert.match(sfc, /ls3-toolbar__combo--format/);
    assert.match(sfc, /import ToolbarAlignSplit from "\.\/ToolbarAlignSplit\.vue"/);
    assert.match(sfc, /axis="horizontal"/);
    assert.match(sfc, /axis="vertical"/);
    assert.doesNotMatch(sfc, /icon="wenbenzuoduiqi"/);
    assert.doesNotMatch(sfc, /title="左对齐"/);
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
      "qingchuyangshi",
      "jiacu",
      "wenbenqingxie1",
      "wenbenshanchuxian",
      "wenbenxiahuaxian",
      "quanjiabiankuang",
      "sizhoujiabiankuang",
      "wubiankuang",
      "hebing",
      "quxiaohebing",
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

const alignSplitPath = path.join(root, "src/components/ToolbarAlignSplit.vue");

describe("ToolbarAlignSplit.vue", () => {
  it("merges horizontal and vertical align into split menus", () => {
    const sfc = fs.readFileSync(alignSplitPath, "utf8");
    assert.match(sfc, /ls3-toolbar__menu/);
    assert.match(sfc, /ls3-toolbar__split--align/);
    assert.match(sfc, /wenbenzuoduiqi/);
    assert.match(sfc, /wenbenjuzhongduiqi/);
    assert.match(sfc, /wenbenyouduiqi/);
    assert.match(sfc, /dingbuduiqi/);
    assert.match(sfc, /shuipingduiqi/);
    assert.match(sfc, /dibuduiqi/);
    assert.match(sfc, /title: "左对齐"/);
    assert.match(sfc, /applyStyleToSelection\(\{ ht: value \}\)/);
    assert.match(sfc, /applyStyleToSelection\(\{ vt: value \}\)/);
  });
});
