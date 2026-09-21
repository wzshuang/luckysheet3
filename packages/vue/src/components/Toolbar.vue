<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ChromeState } from "../composables/useChromeState";
import {
  FORMAT_PRESETS,
  activeCellFormatId,
  type FormatPresetId,
  type WorkbookEngine,
} from "@luckysheet3/core";
import FindReplaceDialog from "./FindReplaceDialog.vue";
import ToolbarButton from "./ToolbarButton.vue";

const props = defineProps<{
  engine: WorkbookEngine;
  chrome: ChromeState;
}>();

const showFind = ref(false);
const fontSize = ref(10);
const fontColor = ref("#000000");
const fillColor = ref("#fff1b8");
const formatId = ref<FormatPresetId>("general");

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

const isBold = computed(() => {
  void props.chrome.selection.value;
  void props.chrome.formulaText.value;
  return !!props.engine.getActiveCellStyle()?.bl;
});
const isItalic = computed(() => {
  void props.chrome.selection.value;
  void props.chrome.formulaText.value;
  return !!props.engine.getActiveCellStyle()?.it;
});

const isPaintFormatActive = computed(() => props.chrome.paintFormatActive.value);

const formatLabel = computed(
  () => FORMAT_PRESETS.find((p) => p.id === formatId.value)?.label ?? "General",
);

function syncFromSelection() {
  const cell = props.engine.getActiveCellStyle();
  fontSize.value = cell?.fs ?? 10;
  fontColor.value = cell?.fc && cell.fc.startsWith("#") ? cell.fc : "#000000";
  if (cell?.bg && cell.bg.startsWith("#")) fillColor.value = cell.bg;
  formatId.value = activeCellFormatId(cell);
}

watch(
  () => [props.chrome.selection.value, props.chrome.formulaText.value],
  () => syncFromSelection(),
  { deep: true },
);

function freezeRow() {
  props.engine.setFreeze(1, 0);
}
function freezeCol() {
  props.engine.setFreeze(0, 1);
}
function clearFreeze() {
  props.engine.setFreeze(0, 0);
}

function onFontSize(e: Event) {
  const v = Number((e.target as HTMLSelectElement).value);
  props.engine.applyStyleToSelection({ fs: v });
}

function onFontColor(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  fontColor.value = v;
  props.engine.applyStyleToSelection({ fc: v });
}

function onFillColor(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  fillColor.value = v;
  props.engine.applyStyleToSelection({ bg: v });
}

function onFormat(e: Event) {
  const v = (e.target as HTMLSelectElement).value as FormatPresetId;
  formatId.value = v;
  props.engine.applyFormatToSelection(v);
}

async function writeSystemClipboard(): Promise<void> {
  const text = props.engine.getClipboardTsv();
  const html = props.engine.getClipboardHtml();
  if (text == null) return;
  try {
    const nav = navigator.clipboard;
    if (nav && "write" in nav && typeof ClipboardItem !== "undefined" && html) {
      await nav.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    }
    if (nav?.writeText) await nav.writeText(text);
  } catch {
    /* in-memory clipboard still works */
  }
}

function onCopy() {
  props.engine.copySelection();
  void writeSystemClipboard();
}

function onCut() {
  props.engine.cutSelection();
  void writeSystemClipboard();
}

async function onPaste() {
  if (props.engine.workbook.clipboard) {
    props.engine.pasteAtSelection();
    return;
  }
  try {
    const nav = navigator.clipboard;
    if (nav && "read" in nav) {
      const items = await nav.read();
      let html: string | undefined;
      let text: string | undefined;
      for (const item of items) {
        if (item.types.includes("text/html")) {
          html = await (await item.getType("text/html")).text();
        }
        if (item.types.includes("text/plain")) {
          text = await (await item.getType("text/plain")).text();
        }
      }
      if (props.engine.pasteFromExternal({ html, text })) return;
    } else if (nav?.readText) {
      const text = await nav.readText();
      if (props.engine.pasteFromExternal({ text })) return;
    }
  } catch {
    /* fall through */
  }
  props.engine.pasteAtSelection();
}

let paintClickTimer: ReturnType<typeof setTimeout> | null = null;

function onPaintClick() {
  if (props.engine.isPaintFormatActive()) {
    if (paintClickTimer) {
      clearTimeout(paintClickTimer);
      paintClickTimer = null;
    }
    props.engine.cancelPaintFormat();
    return;
  }
  if (paintClickTimer) {
    clearTimeout(paintClickTimer);
    paintClickTimer = null;
    props.engine.startPaintFormat(false);
    return;
  }
  paintClickTimer = setTimeout(() => {
    paintClickTimer = null;
    props.engine.startPaintFormat(true);
  }, 250);
}
</script>

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
