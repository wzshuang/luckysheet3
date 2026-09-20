<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { WorkbookEngine } from "@luckysheet3/core";

const props = defineProps<{
  engine: WorkbookEngine;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
let selecting = false;
let anchor = { row: 0, col: 0 };
let resizeObs: ResizeObserver | null = null;

function measure() {
  const el = wrapRef.value;
  if (!el || !canvasRef.value) return;
  const rect = el.getBoundingClientRect();
  props.engine.setViewport(Math.max(100, rect.width), Math.max(100, rect.height));
}

onMounted(() => {
  if (canvasRef.value) {
    props.engine.attachCanvas(canvasRef.value);
    measure();
  }
  resizeObs = new ResizeObserver(() => measure());
  if (wrapRef.value) resizeObs.observe(wrapRef.value);
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  resizeObs?.disconnect();
  props.engine.detachCanvas();
  window.removeEventListener("keydown", onKeyDown);
});

watch(
  () => props.engine,
  (eng, prev) => {
    prev?.detachCanvas();
    if (canvasRef.value) eng.attachCanvas(canvasRef.value);
    measure();
  },
);

function localPos(e: PointerEvent) {
  const el = wrapRef.value!;
  const rect = el.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function onPointerDown(e: PointerEvent) {
  if (props.engine.editing) return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  const { x, y } = localPos(e);
  const hit = props.engine.hitTest(x, y);
  if (!hit) return;
  selecting = true;
  anchor = hit;
  props.engine.execute({
    type: "setSelection",
    selection: [{ row: [hit.row, hit.row], column: [hit.col, hit.col] }],
  });
  wrapRef.value?.focus();
}

function onPointerMove(e: PointerEvent) {
  if (!selecting) return;
  const { x, y } = localPos(e);
  const hit = props.engine.hitTest(x, y);
  if (!hit) return;
  props.engine.execute({
    type: "setSelection",
    selection: [
      {
        row: [anchor.row, hit.row],
        column: [anchor.col, hit.col],
      },
    ],
  });
}

function onPointerUp() {
  selecting = false;
}

function onDblClick() {
  props.engine.startEdit();
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  props.engine.execute({
    type: "setScroll",
    scrollLeft: props.engine.workbook.scrollLeft + e.deltaX,
    scrollTop: props.engine.workbook.scrollTop + e.deltaY,
  });
}

function onKeyDown(e: KeyboardEvent) {
  if (!wrapRef.value?.contains(document.activeElement) && document.activeElement !== wrapRef.value) {
    return;
  }
  if (props.engine.editing) return;

  const sel = props.engine.selection[0];
  if (!sel) return;
  let r = sel.row[0];
  let c = sel.column[0];

  if (e.key === "ArrowUp") {
    e.preventDefault();
    r = Math.max(0, r - 1);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    r += 1;
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    c = Math.max(0, c - 1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    c += 1;
  } else if (e.key === "Enter" || e.key === "F2") {
    e.preventDefault();
    props.engine.startEdit(r, c);
    return;
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    props.engine.execute({ type: "setCellValue", row: r, col: c, value: null });
    return;
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) props.engine.redo();
    else props.engine.undo();
    return;
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    props.engine.redo();
    return;
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    props.engine.startEdit(r, c);
    // CellEditor will pick up; seed via a custom event on engine
    props.engine.workbook.emit({ type: "edit", editing: true, row: r, col: c });
    pendingChar.value = e.key;
    return;
  } else {
    return;
  }

  props.engine.execute({
    type: "setSelection",
    selection: [{ row: [r, r], column: [c, c] }],
  });
}

const pendingChar = ref<string | null>(null);
defineExpose({ pendingChar });
</script>

<template>
  <div
    ref="wrapRef"
    class="ls3-grid"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @dblclick="onDblClick"
    @wheel="onWheel"
  >
    <canvas ref="canvasRef" class="ls3-grid__canvas" />
    <slot :pending-char="pendingChar" :clear-pending="() => (pendingChar = null)" />
  </div>
</template>

<style scoped>
.ls3-grid {
  position: relative;
  flex: 1;
  min-height: 0;
  outline: none;
  overflow: hidden;
  background: #fff;
}
.ls3-grid__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
