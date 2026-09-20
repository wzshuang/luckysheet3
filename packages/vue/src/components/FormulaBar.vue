<script setup lang="ts">
import { ref, watch } from "vue";
import type { ChromeState } from "../composables/useChromeState";
import type { WorkbookEngine } from "@luckysheet3/core";
import { selectionToLabel } from "@luckysheet3/core";

const props = defineProps<{
  engine: WorkbookEngine;
  chrome: ChromeState;
}>();

const draft = ref("");

watch(
  () => props.chrome.formulaText.value,
  (v) => {
    if (!props.engine.editing) draft.value = v;
  },
  { immediate: true },
);

function cellLabel() {
  const sel = props.chrome.selection.value[0];
  if (!sel) return "A1";
  return selectionToLabel(sel);
}

function commit() {
  const sel = props.engine.selection[0];
  if (!sel) return;
  const r = Math.min(sel.row[0], sel.row[1]);
  const c = Math.min(sel.column[0], sel.column[1]);
  const text = draft.value;
  if (text.startsWith("=")) {
    props.engine.execute({ type: "setCellValue", row: r, col: c, value: null, formula: text });
  } else {
    props.engine.execute({
      type: "setCellValue",
      row: r,
      col: c,
      value: text === "" ? null : text,
    });
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    (e.target as HTMLInputElement).blur();
  }
}
</script>

<template>
  <div class="ls3-formula-bar">
    <div class="ls3-formula-bar__name">{{ cellLabel() }}</div>
    <div class="ls3-formula-bar__fx">fx</div>
    <input
      class="ls3-formula-bar__input"
      v-model="draft"
      @keydown="onKeydown"
      @blur="commit"
    />
  </div>
</template>

<style scoped>
.ls3-formula-bar {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #e5e5e5;
  background: #fff;
  min-height: 28px;
}
.ls3-formula-bar__name {
  min-width: 64px;
  max-width: 120px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #e5e5e5;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ls3-formula-bar__fx {
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: italic;
  color: #999;
  border-right: 1px solid #eee;
}
.ls3-formula-bar__input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0 8px;
  font: 13px/28px Consolas, monospace;
}
</style>
