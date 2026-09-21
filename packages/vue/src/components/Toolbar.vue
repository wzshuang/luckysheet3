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
</script>

<template>
  <div class="ls3-toolbar">
    <button type="button" :disabled="chrome.undoDepth.value <= 0" title="Undo" @click="engine.undo()">
      Undo
    </button>
    <button type="button" :disabled="chrome.redoDepth.value <= 0" title="Redo" @click="engine.redo()">
      Redo
    </button>
    <span class="ls3-toolbar__sep" />
    <select class="ls3-toolbar__select" title="Font size" :value="fontSize" @change="onFontSize">
      <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s }}</option>
    </select>
    <button
      type="button"
      title="Bold"
      class="ls3-toolbar__toggle"
      :class="{ 'is-on': isBold }"
      @click="engine.toggleStyleOnSelection('bl')"
    >
      B
    </button>
    <button
      type="button"
      title="Italic"
      class="ls3-toolbar__toggle"
      :class="{ 'is-on': isItalic }"
      @click="engine.toggleStyleOnSelection('it')"
    >
      I
    </button>
    <label class="ls3-toolbar__color" title="Font color">
      A
      <input type="color" :value="fontColor" @input="onFontColor" />
    </label>
    <label class="ls3-toolbar__color" title="Fill color">
      Fill
      <input type="color" :value="fillColor" @input="onFillColor" />
    </label>
    <span class="ls3-toolbar__sep" />
    <button type="button" @click="engine.applyStyleToSelection({ ht: 1 })">Left</button>
    <button type="button" @click="engine.applyStyleToSelection({ ht: 0 })">Center</button>
    <button type="button" @click="engine.applyStyleToSelection({ ht: 2 })">Right</button>
    <button type="button" @click="engine.applyStyleToSelection({ vt: 1 })">Top</button>
    <button type="button" @click="engine.applyStyleToSelection({ vt: 0 })">Middle</button>
    <button type="button" @click="engine.applyStyleToSelection({ vt: 2 })">Bottom</button>
    <span class="ls3-toolbar__sep" />
    <select class="ls3-toolbar__select" title="Number format" :value="formatId" @change="onFormat">
      <option v-for="p in FORMAT_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
    </select>
    <button type="button" title="Clear formatting" @click="engine.clearFormatOnSelection()">
      Clear Fmt
    </button>
    <span class="ls3-toolbar__sep" />
    <button type="button" title="Merge" @click="engine.mergeSelection()">Merge</button>
    <button type="button" title="Unmerge" @click="engine.unmergeSelection()">Unmerge</button>
    <button type="button" title="Insert row" @click="engine.insertRowsAtSelection()">+Row</button>
    <button type="button" title="Delete row" @click="engine.deleteRowsAtSelection()">-Row</button>
    <button type="button" title="Insert col" @click="engine.insertColsAtSelection()">+Col</button>
    <button type="button" title="Delete col" @click="engine.deleteColsAtSelection()">-Col</button>
    <span class="ls3-toolbar__sep" />
    <button type="button" @click="onCopy">Copy</button>
    <button type="button" @click="onCut">Cut</button>
    <button type="button" @click="onPaste">Paste</button>
    <span class="ls3-toolbar__sep" />
    <button type="button" title="Border all" @click="engine.applyBordersToSelection('all')">Border</button>
    <button type="button" title="Outer border" @click="engine.applyBordersToSelection('outside')">Outer</button>
    <button type="button" title="No border" @click="engine.applyBordersToSelection('none')">No Border</button>
    <span class="ls3-toolbar__sep" />
    <button type="button" @click="freezeRow">Freeze Row</button>
    <button type="button" @click="freezeCol">Freeze Col</button>
    <button type="button" @click="engine.freezeSelection()">Freeze Here</button>
    <button type="button" @click="clearFreeze">Unfreeze</button>
    <span class="ls3-toolbar__sep" />
    <button type="button" @click="showFind = true">Find</button>
  </div>
  <FindReplaceDialog v-if="showFind" :engine="engine" @close="showFind = false" />
</template>

<style scoped>
.ls3-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid #e5e5e5;
  background: #fafafa;
}
.ls3-toolbar button,
.ls3-toolbar__select {
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}
.ls3-toolbar button:disabled {
  opacity: 0.4;
  cursor: default;
}
.ls3-toolbar__toggle.is-on {
  background: #e6f4ff;
  border-color: #91caff;
  font-weight: 700;
}
.ls3-toolbar__sep {
  width: 1px;
  height: 18px;
  background: #ddd;
  margin: 0 4px;
}
.ls3-toolbar__color {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 12px;
  background: #fff;
  cursor: pointer;
}
.ls3-toolbar__color input {
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
</style>
