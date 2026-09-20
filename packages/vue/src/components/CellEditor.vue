<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { WorkbookEngine } from "@luckysheet3/core";
import { COL_HEADER_HEIGHT, ROW_HEADER_WIDTH } from "@luckysheet3/core";

const props = defineProps<{
  engine: WorkbookEngine;
  pendingChar?: string | null;
}>();

const emit = defineEmits<{
  consumedChar: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const visible = ref(false);
const text = ref("");
const style = ref<Record<string, string>>({});

let off: (() => void) | undefined;

function syncRect() {
  if (!props.engine.editing) {
    visible.value = false;
    return;
  }
  const rect = props.engine.getCellRect(props.engine.workbook.editRow, props.engine.workbook.editCol);
  style.value = {
    left: `${Math.max(ROW_HEADER_WIDTH, rect.x)}px`,
    top: `${Math.max(COL_HEADER_HEIGHT, rect.y)}px`,
    width: `${Math.max(40, rect.width)}px`,
    height: `${Math.max(18, rect.height)}px`,
  };
  visible.value = true;
}

function syncDraft(value: string) {
  text.value = value;
  props.engine.setEditDraft(value);
}

onMounted(() => {
  off = props.engine.on((e) => {
    if (e.type === "edit") {
      if (e.editing) {
        syncDraft(props.pendingChar ?? props.engine.getEditText());
        if (props.pendingChar) emit("consumedChar");
        syncRect();
        nextTick(() => {
          inputRef.value?.focus();
          if (props.pendingChar) {
            inputRef.value?.setSelectionRange(text.value.length, text.value.length);
          } else {
            inputRef.value?.select();
          }
        });
      } else {
        visible.value = false;
      }
    }
    if (e.type === "scroll" && props.engine.editing) syncRect();
  });
});

onUnmounted(() => off?.());

watch(
  () => props.pendingChar,
  (ch) => {
    if (ch && props.engine.editing) {
      syncDraft(ch);
      emit("consumedChar");
      nextTick(() => inputRef.value?.focus());
    }
  },
);

watch(text, (v) => {
  if (props.engine.editing) props.engine.setEditDraft(v);
});

function commit() {
  props.engine.commitEdit(text.value);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    commit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    props.engine.cancelEdit();
  }
  e.stopPropagation();
}
</script>

<template>
  <input
    v-show="visible"
    ref="inputRef"
    class="ls3-editor"
    :style="style"
    v-model="text"
    @keydown="onKeydown"
    @blur="commit"
  />
</template>

<style scoped>
.ls3-editor {
  position: absolute;
  z-index: 5;
  border: 2px solid #0188fb;
  padding: 0 4px;
  margin: 0;
  font: 10pt sans-serif;
  outline: none;
  box-sizing: border-box;
  background: #fff;
}
</style>
