<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from "vue";
import type { HeaderLayout, WorkbookEngine } from "@luckysheet3/core";
import { buildHeaderLayout } from "@luckysheet3/core";
import GridHeaderCol from "./GridHeaderCol.vue";
import GridHeaderRow from "./GridHeaderRow.vue";

const props = defineProps<{
  engine: WorkbookEngine;
  gridRoot: HTMLElement | null;
}>();

const layout = shallowRef<HeaderLayout | null>(null);

function refresh() {
  layout.value = buildHeaderLayout(props.engine.workbook, props.engine.getViewport());
}

let off: (() => void) | undefined;

onMounted(() => {
  refresh();
  off = props.engine.on(() => refresh());
});

onUnmounted(() => off?.());

function onCornerClick() {
  if (props.engine.editing) {
    props.engine.commitEdit();
  }
  props.engine.selectAll();
  props.gridRoot?.focus();
}
</script>

<template>
  <template v-if="layout">
    <button type="button" class="ls3-grid__corner" aria-label="全选" @click="onCornerClick" />
    <GridHeaderCol :engine="engine" :layout="layout" :grid-root="gridRoot" />
    <GridHeaderRow :engine="engine" :layout="layout" :grid-root="gridRoot" />
  </template>
</template>
