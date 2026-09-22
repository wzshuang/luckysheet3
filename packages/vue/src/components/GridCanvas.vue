<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { ChromeState } from "../composables/useChromeState";
import type { SelectionRange, WorkbookEngine } from "@luckysheet3/core";
import { COL_HEADER_HEIGHT, ROW_HEADER_WIDTH } from "@luckysheet3/core";
import GridHeaders from "./GridHeaders.vue";

const props = defineProps<{
  engine: WorkbookEngine;
  chrome: ChromeState;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
const cellSurfaceRef = ref<HTMLDivElement | null>(null);
const pendingChar = ref<string | null>(null);

let selecting = false;
let filling = false;
let fillFrom: SelectionRange | null = null;
let anchor = { row: 0, col: 0 };
let mods = { shift: false, ctrl: false };
let resizeObs: ResizeObserver | null = null;

function measure() {
  const el = cellSurfaceRef.value;
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
  if (cellSurfaceRef.value) resizeObs.observe(cellSurfaceRef.value);
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

function gridPosFromSurface(e: PointerEvent) {
  const el = cellSurfaceRef.value!;
  const rect = el.getBoundingClientRect();
  return {
    x: e.clientX - rect.left + ROW_HEADER_WIDTH,
    y: e.clientY - rect.top + COL_HEADER_HEIGHT,
  };
}

function onPointerDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  const { x, y } = gridPosFromSurface(e);
  mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };

  if (props.engine.editing) {
    const hit = props.engine.hitTest(x, y);
    if (hit) {
      props.engine.commitEditAndSelect(hit.row, hit.col);
      selecting = true;
      anchor = hit;
      wrapRef.value?.focus();
    }
    return;
  }

  if (props.engine.getFillHandleAt(x, y)) {
    const sel = props.engine.getActiveRange();
    if (sel) {
      fillFrom = {
        row: [Math.min(sel.row[0], sel.row[1]), Math.max(sel.row[0], sel.row[1])],
        column: [
          Math.min(sel.column[0], sel.column[1]),
          Math.max(sel.column[0], sel.column[1]),
        ],
        row_focus: sel.row_focus,
        column_focus: sel.column_focus,
      };
      filling = true;
    }
    return;
  }

  const hit = props.engine.hitTest(x, y);
  if (!hit) return;
  selecting = true;
  anchor = hit;
  props.engine.selectAt(hit.row, hit.col, { shift: mods.shift, ctrl: mods.ctrl });
  wrapRef.value?.focus();
}

function onPointerMove(e: PointerEvent) {
  const { x, y } = gridPosFromSurface(e);
  if (filling && fillFrom) {
    const hit = props.engine.hitTest(x, y);
    if (!hit) return;
    props.engine.execute({
      type: "setSelection",
      selection: [
        {
          row: [fillFrom.row[0], hit.row],
          column: [fillFrom.column[0], hit.col],
          row_focus: fillFrom.row_focus ?? fillFrom.row[0],
          column_focus: fillFrom.column_focus ?? fillFrom.column[0],
        },
      ],
    });
    return;
  }
  if (!selecting) return;
  const hit = props.engine.hitTest(x, y);
  if (!hit) return;
  const rest = props.engine.selection.slice(0, -1);
  props.engine.execute({
    type: "setSelection",
    selection: [
      ...rest,
      {
        row: [anchor.row, hit.row],
        column: [anchor.col, hit.col],
        row_focus: anchor.row,
        column_focus: anchor.col,
      },
    ],
  });
}

function onPointerUp() {
  if (filling && fillFrom) {
    const sel = props.engine.getActiveRange();
    if (sel) {
      props.engine.execute({ type: "fillCells", from: fillFrom, to: sel });
    }
  }
  if (props.engine.isPaintFormatActive()) {
    props.engine.applyPaintFormatToSelection();
  }
  selecting = false;
  filling = false;
  fillFrom = null;
  mods = { shift: false, ctrl: false };
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

async function writeSystemClipboard(): Promise<void> {
  const text = props.engine.getClipboardTsv();
  const html = props.engine.getClipboardHtml();
  if (text == null) return;
  try {
    const nav = navigator.clipboard;
    if (nav && "write" in nav && typeof ClipboardItem !== "undefined" && html) {
      await nav.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    }
    if (nav?.writeText) await nav.writeText(text);
  } catch {
    // Permission / insecure context — in-memory clipboard still works
  }
}

async function pasteWithSystemClipboard(): Promise<void> {
  if (props.engine.workbook.clipboard) {
    props.engine.pasteAtSelection();
    return;
  }
  try {
    const nav = navigator.clipboard;
    if (nav && "read" in nav) {
      const items = await nav.read();
      let html: string | undefined;
      let text: string | undefined;
      for (const item of items) {
        if (item.types.includes("text/html")) {
          html = await (await item.getType("text/html")).text();
        }
        if (item.types.includes("text/plain")) {
          text = await (await item.getType("text/plain")).text();
        }
      }
      if (props.engine.pasteFromExternal({ html, text })) return;
    } else if (nav?.readText) {
      const text = await nav.readText();
      if (props.engine.pasteFromExternal({ text })) return;
    }
  } catch {
    // fall through
  }
  props.engine.pasteAtSelection();
}

function onKeyDown(e: KeyboardEvent) {
  if (!wrapRef.value?.contains(document.activeElement) && document.activeElement !== wrapRef.value) {
    return;
  }
  if (props.engine.editing) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
    e.preventDefault();
    props.engine.selectAll();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    e.preventDefault();
    props.engine.copySelection();
    void writeSystemClipboard();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
    e.preventDefault();
    props.engine.cutSelection();
    void writeSystemClipboard();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
    e.preventDefault();
    void pasteWithSystemClipboard();
    return;
  }
  if (e.key === "Escape") {
    if (props.engine.isPaintFormatActive()) {
      e.preventDefault();
      props.engine.cancelPaintFormat();
      return;
    }
    if (props.engine.workbook.copyHighlight) {
      e.preventDefault();
      props.engine.clearCopyHighlight();
      return;
    }
  }

  const focus = props.engine.getFocusCell();
  if (!focus) return;
  let r = focus.row;
  let c = focus.col;

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
    props.engine.workbook.emit({ type: "edit", editing: true, row: r, col: c });
    pendingChar.value = e.key;
    return;
  } else {
    return;
  }

  if (e.shiftKey) {
    props.engine.selectAt(r, c, { shift: true });
  } else {
    props.engine.selectAt(r, c);
  }
}

defineExpose({ pendingChar });
</script>

<template>
  <div
    ref="wrapRef"
    class="ls3-grid"
    :class="{ 'ls3-grid--paint': props.chrome.paintFormatActive.value }"
    tabindex="0"
    @wheel="onWheel"
  >
    <GridHeaders :engine="props.engine" :grid-root="wrapRef" />
    <div ref="cellSurfaceRef" class="ls3-grid__surface">
      <canvas
        ref="canvasRef"
        class="ls3-grid__canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @dblclick="onDblClick"
      />
      <slot :pending-char="pendingChar" :clear-pending="() => (pendingChar = null)" />
    </div>
  </div>
</template>

<style scoped>
.ls3-grid {
  display: grid;
  grid-template-columns: var(--ls3-row-header-width, 46px) 1fr;
  grid-template-rows: var(--ls3-col-header-height, 20px) 1fr;
  position: relative;
  flex: 1;
  min-height: 0;
  outline: none;
  overflow: hidden;
  background: #fff;
}
.ls3-grid--paint {
  cursor: cell;
}
.ls3-grid__surface {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  z-index: 0;
}
.ls3-grid__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
