<script setup lang="ts">
import type { ChromeState } from "../composables/useChromeState";
import type { WorkbookEngine } from "@luckysheet3/core";

defineProps<{
  engine: WorkbookEngine;
  chrome: ChromeState;
}>();
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
    <button
      type="button"
      title="Bold"
      @click="engine.applyStyleToSelection({ bl: 1 })"
    >
      B
    </button>
    <button
      type="button"
      title="Italic"
      @click="engine.applyStyleToSelection({ it: 1 })"
    >
      I
    </button>
    <button type="button" title="Font color" @click="engine.applyStyleToSelection({ fc: '#d4380d' })">
      A
    </button>
    <button type="button" title="Fill" @click="engine.applyStyleToSelection({ bg: '#fff1b8' })">
      Fill
    </button>
    <span class="ls3-toolbar__sep" />
    <button type="button" @click="engine.applyStyleToSelection({ ht: 1 })">Left</button>
    <button type="button" @click="engine.applyStyleToSelection({ ht: 0 })">Center</button>
    <button type="button" @click="engine.applyStyleToSelection({ ht: 2 })">Right</button>
  </div>
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
.ls3-toolbar button {
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
.ls3-toolbar__sep {
  width: 1px;
  height: 18px;
  background: #ddd;
  margin: 0 4px;
}
</style>
