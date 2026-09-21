<script setup lang="ts">
import { computed, ref } from "vue";
import type { HeaderLayout, WorkbookEngine } from "@luckysheet3/core";
import {
  buildColOffsets,
  colIndexAtContentX,
  colLeft,
  colResizeIndexAtContentX,
} from "@luckysheet3/core";

const props = defineProps<{
  engine: WorkbookEngine;
  layout: HeaderLayout;
  gridRoot: HTMLElement | null;
}>();

const rootRef = ref<HTMLElement | null>(null);
let headerDrag: { start: number } | null = null;
let resizing: { index: number; startX: number; size: number } | null = null;
const resizeLineX = ref<number | null>(null);

const colOffsets = computed(() => buildColOffsets(props.engine.workbook.getActiveSheet()));

const bands = computed(() => {
  const scroll = props.layout.scrollLeft;
  const offsets = colOffsets.value;
  return props.layout.colSelection.map((b) => {
    const left = colLeft(offsets, b.startIndex) - scroll;
    const right = offsets[b.endIndex] ?? colLeft(offsets, b.endIndex);
    return { left, width: right - colLeft(offsets, b.startIndex) };
  });
});

function contentXFromEvent(e: PointerEvent): number {
  const rect = rootRef.value!.getBoundingClientRect();
  return e.clientX - rect.left + props.layout.scrollLeft;
}

function focusGrid() {
  props.gridRoot?.focus();
}

function onPointerDown(e: PointerEvent) {
  const contentX = contentXFromEvent(e);
  const resizeCol = colResizeIndexAtContentX(
    props.engine.workbook.getActiveSheet(),
    contentX,
    colOffsets.value,
  );
  if (resizeCol != null) {
    resizing = {
      index: resizeCol,
      startX: e.clientX,
      size: props.engine.workbook.getActiveSheet().getColWidth(resizeCol),
    };
    resizeLineX.value =
      colLeft(colOffsets.value, resizeCol) +
      props.engine.workbook.getActiveSheet().getColWidth(resizeCol) -
      props.layout.scrollLeft;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }

  if (props.engine.editing) {
    props.engine.commitEdit();
  }

  const col = colIndexAtContentX(
    props.engine.workbook.getActiveSheet(),
    contentX,
    colOffsets.value,
  );
  if (col == null) return;

  headerDrag = { start: col };
  props.engine.selectColumn(col, { shift: e.shiftKey });
  focusGrid();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (resizing) {
    const dw = e.clientX - resizing.startX;
    props.engine.execute({
      type: "setColWidth",
      col: resizing.index,
      width: Math.max(4, resizing.size + dw),
    });
    resizeLineX.value =
      colLeft(colOffsets.value, resizing.index) +
      props.engine.workbook.getActiveSheet().getColWidth(resizing.index) -
      props.layout.scrollLeft;
    return;
  }
  if (!headerDrag) return;
  const col = colIndexAtContentX(
    props.engine.workbook.getActiveSheet(),
    contentXFromEvent(e),
    colOffsets.value,
  );
  if (col != null) {
    props.engine.selectColumn(headerDrag.start, { endCol: col });
  }
}

function onPointerUp() {
  headerDrag = null;
  resizing = null;
  resizeLineX.value = null;
}
</script>

<template>
  <div
    ref="rootRef"
    class="ls3-grid__col-header"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      class="ls3-grid__header-track"
      :style="{ transform: `translateX(${-layout.scrollLeft}px)` }"
    >
      <div
        v-for="item in layout.colItems"
        :key="item.index"
        class="ls3-grid__header-cell"
        :style="{ left: `${item.offset}px`, width: `${item.size}px`, top: 0, height: '100%' }"
      >
        {{ item.label }}
      </div>
      <div
        v-for="(band, i) in bands"
        :key="`sel-${i}`"
        class="ls3-grid__header-select"
        :style="{ left: `${band.left}px`, width: `${band.width}px`, top: 0, height: '100%' }"
      />
    </div>
    <div
      v-if="resizeLineX != null"
      class="ls3-grid__header-resize-line"
      :style="{ left: `${resizeLineX}px`, top: 0, width: '1px', height: '100%' }"
    />
  </div>
</template>
