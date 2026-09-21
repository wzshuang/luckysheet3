<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { ChromeState } from "../composables/useChromeState";
import type { WorkbookEngine } from "@luckysheet3/core";

type Axis = "horizontal" | "vertical";

type AlignItem = {
  icon: string;
  title: string;
  value: number;
};

const DEFAULT_HT = 1;
const DEFAULT_VT = 0;

const HORIZONTAL: AlignItem[] = [
  { icon: "wenbenzuoduiqi", title: "左对齐", value: 1 },
  { icon: "wenbenjuzhongduiqi", title: "中间对齐", value: 0 },
  { icon: "wenbenyouduiqi", title: "右对齐", value: 2 },
];

const VERTICAL: AlignItem[] = [
  { icon: "dingbuduiqi", title: "顶部对齐", value: 1 },
  { icon: "shuipingduiqi", title: "居中对齐", value: 0 },
  { icon: "dibuduiqi", title: "底部对齐", value: 2 },
];

const props = defineProps<{
  axis: Axis;
  engine: WorkbookEngine;
  chrome: ChromeState;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const rootEl = ref<HTMLElement | null>(null);

const items = computed(() => (props.axis === "horizontal" ? HORIZONTAL : VERTICAL));

const currentValue = computed(() => {
  void props.chrome.styleRev.value;
  const cell = props.engine.getActiveCellStyle();
  if (props.axis === "horizontal") {
    const ht = cell?.ht;
    return ht === 0 || ht === 1 || ht === 2 ? ht : DEFAULT_HT;
  }
  const vt = cell?.vt;
  return vt === 0 || vt === 1 || vt === 2 ? vt : DEFAULT_VT;
});

const currentItem = computed(() => {
  const found = items.value.find((item) => item.value === currentValue.value);
  if (found) return found;
  const fallback = props.axis === "horizontal" ? DEFAULT_HT : DEFAULT_VT;
  return items.value.find((item) => item.value === fallback) ?? items.value[0]!;
});

const leftTitle = computed(() => (props.axis === "horizontal" ? "水平对齐" : "垂直对齐"));

function apply(value: number) {
  if (props.axis === "horizontal") {
    props.engine.applyStyleToSelection({ ht: value });
    return;
  }
  props.engine.applyStyleToSelection({ vt: value });
}

function onLeft() {
  apply(currentValue.value);
  emit("update:open", false);
}

function toggleMenu() {
  emit("update:open", !props.open);
}

function onPick(value: number) {
  apply(value);
  emit("update:open", false);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open) emit("update:open", false);
}

function onDocPointer(e: Event) {
  if (!props.open) return;
  const target = e.target;
  if (target instanceof Node && rootEl.value?.contains(target)) return;
  emit("update:open", false);
}

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", onDocPointer);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("pointerdown", onDocPointer);
});
</script>

<template>
  <div ref="rootEl" class="ls3-toolbar__split ls3-toolbar__split--align">
    <button type="button" class="ls3-toolbar__split-left" :title="leftTitle" @click="onLeft">
      <i
        class="iconfont-luckysheet ls3-toolbar__icon"
        :class="`luckysheet-iconfont-${currentItem.icon}`"
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      class="ls3-toolbar__split-right"
      title="对齐方式"
      :aria-expanded="open"
      @click="toggleMenu"
    >
      <i class="iconfont-luckysheet luckysheet-iconfont-xiayige" aria-hidden="true" />
    </button>
    <ul v-if="open" class="ls3-toolbar__menu" role="menu">
      <li v-for="item in items" :key="item.icon" role="none">
        <button
          type="button"
          class="ls3-toolbar__menu-item"
          role="menuitem"
          :title="item.title"
          @click="onPick(item.value)"
        >
          <i class="ls3-toolbar__menu-check" :class="{ 'is-on': item.value === currentValue }" aria-hidden="true" />
          <span class="ls3-toolbar__menu-label">{{ item.title }}</span>
          <i
            class="iconfont-luckysheet ls3-toolbar__menu-icon"
            :class="`luckysheet-iconfont-${item.icon}`"
            aria-hidden="true"
          />
        </button>
      </li>
    </ul>
  </div>
</template>
