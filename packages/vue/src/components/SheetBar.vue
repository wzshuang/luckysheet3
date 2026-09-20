<script setup lang="ts">
import type { ChromeState } from "../composables/useChromeState";
import type { WorkbookEngine } from "@luckysheet3/core";

defineProps<{
  engine: WorkbookEngine;
  chrome: ChromeState;
}>();
</script>

<template>
  <div class="ls3-sheetbar">
    <button
      v-for="s in chrome.sheets.value"
      :key="String(s.index)"
      type="button"
      class="ls3-sheetbar__tab"
      :class="{ 'is-active': s.index === chrome.activeSheetIndex.value }"
      @click="engine.execute({ type: 'switchSheet', index: s.index })"
    >
      {{ s.name }}
    </button>
  </div>
</template>

<style scoped>
.ls3-sheetbar {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  border-top: 1px solid #e5e5e5;
  background: #f7f7f7;
}
.ls3-sheetbar__tab {
  border: 1px solid transparent;
  background: transparent;
  padding: 4px 12px;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  font-size: 12px;
}
.ls3-sheetbar__tab.is-active {
  background: #fff;
  border-color: #e5e5e5;
  border-bottom-color: #fff;
}
</style>
