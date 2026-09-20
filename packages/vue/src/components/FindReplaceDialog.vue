<script setup lang="ts">
import { ref } from "vue";
import type { WorkbookEngine } from "@luckysheet3/core";

const props = defineProps<{ engine: WorkbookEngine }>();
const emit = defineEmits<{ close: [] }>();

const query = ref("");
const replacement = ref("");
const matchCase = ref(false);
const status = ref("");

function find() {
  const hit = props.engine.findNext(query.value, matchCase.value);
  status.value = hit ? `Found at R${hit.row + 1}C${hit.col + 1}` : "Not found";
}

function replaceAll() {
  props.engine.replaceAll(query.value, replacement.value, matchCase.value);
  status.value = "Replaced";
}
</script>

<template>
  <div class="ls3-find" role="dialog">
    <div class="ls3-find__panel">
      <header>
        <strong>Find / Replace</strong>
        <button type="button" @click="emit('close')">×</button>
      </header>
      <label>
        Find
        <input v-model="query" @keydown.enter.prevent="find" />
      </label>
      <label>
        Replace
        <input v-model="replacement" />
      </label>
      <label class="ls3-find__check">
        <input type="checkbox" v-model="matchCase" />
        Match case
      </label>
      <div class="ls3-find__actions">
        <button type="button" @click="find">Find next</button>
        <button type="button" @click="replaceAll">Replace all</button>
      </div>
      <p class="ls3-find__status">{{ status }}</p>
    </div>
  </div>
</template>

<style scoped>
.ls3-find {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 50;
}
.ls3-find__panel {
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 12px 16px;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ls3-find__panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ls3-find__panel label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.ls3-find__panel input[type="text"],
.ls3-find__panel input:not([type]) {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 4px 8px;
}
.ls3-find__check {
  flex-direction: row !important;
  align-items: center;
}
.ls3-find__actions {
  display: flex;
  gap: 8px;
}
.ls3-find__actions button {
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
}
.ls3-find__status {
  margin: 0;
  font-size: 12px;
  color: #666;
  min-height: 16px;
}
</style>
