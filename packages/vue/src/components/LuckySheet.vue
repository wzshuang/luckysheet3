<script setup lang="ts">
import { onMounted, onUnmounted, provide, shallowRef, watch } from "vue";
import {
  WorkbookEngine,
  type LuckyOp,
  type LuckySheetRaw,
  type SelectionRange,
  type SheetSnapshot,
} from "@luckysheet3/core";
import { LUCKY_ENGINE_KEY } from "../composables/useLuckySheet";
import { useChromeState } from "../composables/useChromeState";
import GridCanvas from "./GridCanvas.vue";
import CellEditor from "./CellEditor.vue";
import Toolbar from "./Toolbar.vue";
import FormulaBar from "./FormulaBar.vue";
import SheetBar from "./SheetBar.vue";

const props = withDefaults(
  defineProps<{
    data?: LuckySheetRaw[] | SheetSnapshot[];
    lang?: string;
    /** Optional external engine (compat layer). Caller owns lifecycle. */
    engine?: WorkbookEngine;
  }>(),
  { lang: "zh" },
);

const emit = defineEmits<{
  change: [];
  selectionChange: [selection: SelectionRange[]];
  op: [op: LuckyOp];
}>();

const ownsEngine = !props.engine;
const engineRef = shallowRef<WorkbookEngine | null>(
  props.engine ?? new WorkbookEngine(props.data),
);
provide(LUCKY_ENGINE_KEY, engineRef);

const chrome = useChromeState(engineRef.value!);

let off: (() => void) | undefined;

onMounted(() => {
  off = engineRef.value!.on((e) => {
    if (e.type === "change") emit("change");
    if (e.type === "selection") emit("selectionChange", e.selection);
    if (e.type === "op") emit("op", e.op);
  });
});

onUnmounted(() => {
  off?.();
  if (ownsEngine) {
    engineRef.value?.destroy();
  } else {
    engineRef.value?.detachCanvas();
  }
  engineRef.value = null;
});

watch(
  () => props.data,
  (data) => {
    if (data && engineRef.value && ownsEngine) {
      engineRef.value.load(data);
    }
  },
);

defineExpose({
  engine: engineRef,
});
</script>

<template>
  <div class="ls3-root" :data-lang="lang">
    <slot name="toolbar" :engine="engineRef!" :chrome="chrome">
      <Toolbar :engine="engineRef!" :chrome="chrome" />
    </slot>
    <slot name="formula-bar" :engine="engineRef!" :chrome="chrome">
      <FormulaBar :engine="engineRef!" :chrome="chrome" />
    </slot>
    <div class="ls3-root__body">
      <GridCanvas :engine="engineRef!" v-slot="{ pendingChar: pc, clearPending }">
        <CellEditor
          :engine="engineRef!"
          :pending-char="pc"
          @consumed-char="clearPending?.()"
        />
      </GridCanvas>
    </div>
    <slot name="sheet-bar" :engine="engineRef!" :chrome="chrome">
      <SheetBar :engine="engineRef!" :chrome="chrome" />
    </slot>
  </div>
</template>

<style>
.ls3-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 320px;
  border: 1px solid #d9d9d9;
  background: #fff;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.ls3-root__body {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
}
</style>
