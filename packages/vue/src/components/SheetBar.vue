<script setup lang="ts">
import { ref } from "vue";
import type { ChromeState } from "../composables/useChromeState";
import type { WorkbookEngine } from "@luckysheet3/core";

const props = defineProps<{
  engine: WorkbookEngine;
  chrome: ChromeState;
}>();

const editingIndex = ref<string | number | null>(null);
const editName = ref("");

function startRename(index: string | number, name: string) {
  editingIndex.value = index;
  editName.value = name;
}

function commitRename() {
  if (editingIndex.value == null) return;
  const name = editName.value.trim();
  if (name) props.engine.renameSheet(editingIndex.value, name);
  editingIndex.value = null;
}

function cancelRename() {
  editingIndex.value = null;
}

function onDelete(index: string | number) {
  if (props.chrome.sheets.value.length <= 1) return;
  props.engine.deleteSheet(index);
}
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
      @dblclick.stop="startRename(s.index, s.name)"
    >
      <input
        v-if="editingIndex === s.index"
        v-model="editName"
        class="ls3-sheetbar__input"
        @click.stop
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="cancelRename"
        @blur="commitRename"
      />
      <template v-else>
        <span>{{ s.name }}</span>
        <span
          v-if="chrome.sheets.value.length > 1"
          class="ls3-sheetbar__close"
          title="Delete sheet"
          @click.stop="onDelete(s.index)"
        >×</span>
      </template>
    </button>
    <button
      type="button"
      class="ls3-sheetbar__add"
      title="Add sheet"
      @click="engine.addSheet()"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.ls3-sheetbar {
  display: flex;
  gap: 2px;
  align-items: center;
  padding: 4px 8px;
  border-top: 1px solid #e5e5e5;
  background: #f7f7f7;
}
.ls3-sheetbar__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
.ls3-sheetbar__close {
  opacity: 0.45;
  font-size: 14px;
  line-height: 1;
}
.ls3-sheetbar__close:hover {
  opacity: 1;
  color: #cf1322;
}
.ls3-sheetbar__add {
  border: 1px dashed #d9d9d9;
  background: #fff;
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 14px;
}
.ls3-sheetbar__input {
  width: 72px;
  border: 1px solid #0188fb;
  border-radius: 2px;
  padding: 1px 4px;
  font-size: 12px;
}
</style>
