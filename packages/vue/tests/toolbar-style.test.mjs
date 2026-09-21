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
