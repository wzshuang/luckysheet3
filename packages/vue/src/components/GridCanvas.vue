<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { SelectionRange, WorkbookEngine } from "@luckysheet3/core";

const props = defineProps<{
  engine: WorkbookEngine;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
const pendingChar = ref<string | null>(null);

let selecting = false;
let filling = false;
let fillFrom: SelectionRange | null = null;
let resizing: { kind: "row" | "col"; index: number; start: number; size: number } | null =
  null;
let headerDrag: { kind: "row" | "col"; start: number } | null = null;
let anchor = { row: 0, col: 0 };
let mods = { shift: false, ctrl: false };
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
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  const { x, y } = localPos(e);
  mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };

  // While editing: commit draft and select the clicked cell (Lucky/Excel behavior)
  if (props.engine.editing) {
    if (props.engine.hitCorner(x, y)) {
      props.engine.commitEdit();
      props.engine.selectAll();
      wrapRef.value?.focus();
      return;
    }
    const rowH = props.engine.hitRowHeader(x, y);
    if (rowH != null) {
      props.engine.commitEdit();
      props.engine.selectRow(rowH);
      wrapRef.value?.focus();
      return;
    }
    const colH = props.engine.hitColHeader(x, y);
    if (colH != null) {
      props.engine.commitEdit();
      props.engine.selectColumn(colH);
      wrapRef.value?.focus();
      return;
    }
    const hit = props.engine.hitTest(x, y);
    if (hit) {
      props.engine.commitEditAndSelect(hit.row, hit.col);
      selecting = true;
      anchor = hit;
      wrapRef.value?.focus();
    }
    return;
  }

  // Top-left corner → select all cells
  if (props.engine.hitCorner(x, y)) {
    props.engine.selectAll();
    wrapRef.value?.focus();
    return;
  }

  const rowEdge = props.engine.hitRowResize(x, y);
  if (rowEdge != null) {
    resizing = {
      kind: "row",
      index: rowEdge,
      start: y,
      size: props.engine.workbook.getActiveSheet().getRowHeight(rowEdge),
    };
    return;
  }
  const colEdge = props.engine.hitColResize(x, y);
  if (colEdge != null) {
    resizing = {
      kind: "col",
      index: colEdge,
      start: x,
      size: props.engine.workbook.getActiveSheet().getColWidth(colEdge),
    };
    return;
  }

  const rowHeader = props.engine.hitRowHeader(x, y);
  if (rowHeader != null) {
    headerDrag = { kind: "row", start: rowHeader };
    props.engine.selectRow(rowHeader, { shift: mods.shift });
    wrapRef.value?.focus();
    return;
  }

  const colHeader = props.engine.hitColHeader(x, y);
  if (colHeader != null) {
    headerDrag = { kind: "col", start: colHeader };
    props.engine.selectColumn(colHeader, { shift: mods.shift });
    wrapRef.value?.focus();
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
  const { x, y } = localPos(e);
  if (resizing) {
    if (resizing.kind === "row") {
      props.engine.execute({
        type: "setRowHeight",
        row: resizing.index,
        height: Math.max(4, resizing.size + (y - resizing.start)),
      });
    } else {
      props.engine.execute({
        type: "setColWidth",
        col: resizing.index,
        width: Math.max(4, resizing.size + (x - resizing.start)),
      });
    }
    return;
  }
  if (headerDrag) {
    if (headerDrag.kind === "row") {
      const row = props.engine.hitRowHeader(x, y);
      if (row != null) {
        props.engine.selectRow(headerDrag.start, { endRow: row });
      }
    } else {
      const col = props.engine.hitColHeader(x, y);
      if (col != null) {
        props.engine.selectColumn(headerDrag.start, { endCol: col });
      }
    }
    return;
  }
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
  // Drag expands from mousedown anchor (focus stays at anchor)
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
  selecting = false;
  filling = false;
  fillFrom = null;
  resizing = null;
  headerDrag = null;
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
  // Prefer styled in-memory payload when we copied inside the app
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
