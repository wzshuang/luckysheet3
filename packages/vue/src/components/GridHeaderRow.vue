<script setup lang="ts">
import { computed, ref } from "vue";
import type { HeaderLayout, WorkbookEngine } from "@luckysheet3/core";
import {
  buildRowOffsets,
  rowIndexAtContentY,
  rowResizeIndexAtContentY,
  rowTop,
} from "@luckysheet3/core";

const props = defineProps<{
  engine: WorkbookEngine;
  layout: HeaderLayout;
  gridRoot: HTMLElement | null;
}>();

const rootRef = ref<HTMLElement | null>(null);
let headerDrag: { start: number } | null = null;
let resizing: { index: number; startY: number; size: number } | null = null;
const resizeLineY = ref<number | null>(null);

const rowOffsets = computed(() => buildRowOffsets(props.engine.workbook.getActiveSheet()));

const bands = computed(() => {
  const scroll = props.layout.scrollTop;
  const offsets = rowOffsets.value;
  return props.layout.rowSelection.map((b) => {
    const top = rowTop(offsets, b.startIndex) - scroll;
    const bottom = offsets[b.endIndex] ?? rowTop(offsets, b.endIndex);
    return { top, height: bottom - rowTop(offsets, b.startIndex) };
  });
});

function contentYFromEvent(e: PointerEvent): number {
  const rect = rootRef.value!.getBoundingClientRect();
  return e.clientY - rect.top + props.layout.scrollTop;
}

function focusGrid() {
  props.gridRoot?.focus();
}

function onPointerDown(e: PointerEvent) {
  const contentY = contentYFromEvent(e);
  const resizeRow = rowResizeIndexAtContentY(
    props.engine.workbook.getActiveSheet(),
    contentY,
    rowOffsets.value,
  );
  if (resizeRow != null) {
    resizing = {
      index: resizeRow,
      startY: e.clientY,
      size: props.engine.workbook.getActiveSheet().getRowHeight(resizeRow),
    };
    resizeLineY.value =
      (rowOffsets.value[resizeRow] ?? 0) - props.layout.scrollTop;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }

  if (props.engine.editing) {
    props.engine.commitEdit();
  }

  const row = rowIndexAtContentY(
    props.engine.workbook.getActiveSheet(),
    contentY,
    rowOffsets.value,
  );
  if (row == null) return;

  headerDrag = { start: row };
  props.engine.selectRow(row, { shift: e.shiftKey });
  focusGrid();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (resizing) {
    const dh = e.clientY - resizing.startY;
    props.engine.execute({
      type: "setRowHeight",
      row: resizing.index,
      height: Math.max(4, resizing.size + dh),
    });
    resizeLineY.value =
      (rowOffsets.value[resizing.index] ?? 0) - props.layout.scrollTop;
    return;
  }
  if (!headerDrag) return;
  const row = rowIndexAtContentY(
    props.engine.workbook.getActiveSheet(),
    contentYFromEvent(e),
    rowOffsets.value,
  );
  if (row != null) {
    props.engine.selectRow(headerDrag.start, { endRow: row });
  }
}

function onPointerUp() {
  headerDrag = null;
  resizing = null;
  resizeLineY.value = null;
}
</script>

<template>
  <div
    ref="rootRef"
    class="ls3-grid__row-header"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      class="ls3-grid__header-track"
      :style="{ transform: `translateY(${-layout.scrollTop}px)` }"
    >
      <div
        v-for="item in layout.rowItems"
        :key="item.index"
        class="ls3-grid__header-cell"
        :style="{ top: `${item.offset}px`, height: `${item.size}px` }"
      >
        {{ item.label }}
      </div>
      <div
        v-for="(band, i) in bands"
        :key="`sel-${i}`"
        class="ls3-grid__header-select"
        :style="{ top: `${band.top}px`, height: `${band.height}px`, left: 0, right: 0 }"
      />
    </div>
    <div
      v-if="resizeLineY != null"
      class="ls3-grid__header-resize-line"
      :style="{ top: `${resizeLineY}px`, left: 0, height: '1px', width: '100%' }"
    />
  </div>
</template>
