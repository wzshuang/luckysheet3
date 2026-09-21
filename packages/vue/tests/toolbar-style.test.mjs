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
