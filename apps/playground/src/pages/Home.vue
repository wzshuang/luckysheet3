<script setup lang="ts">
import { computed } from "vue";
import { LuckySheet } from "@luckysheet3/vue";
import { cellSheetForCompare, CELL_SHEET_KNOWN_GAPS } from "../data/cell-sheet";

const cellSheets = cellSheetForCompare();

/** Override with full URL if原版 runs on another host */
const originalDemoUrl = computed(
  () =>
    import.meta.env.VITE_LUCKYSHEET_DEMO_URL ||
    `${import.meta.env.BASE_URL}luckysheet-original/index.html`,
);
</script>

<template>
  <div class="compare">
    <p class="compare__hint">
      左：原版 Demo（请切换到第一个 Sheet「Cell」）；右：Luckysheet3 直接加载同一份
      <code>sheetCell</code> JSON（<code>fixtures/lucky/sheet-cell.json</code>）。未实现的能力保留在数据里但不强行模拟，方便对照差距。
    </p>
    <details class="compare__gaps">
      <summary>右侧预期与原版不一致项（已知缺口）</summary>
      <ul>
        <li v-for="(g, i) in CELL_SHEET_KNOWN_GAPS" :key="i">{{ g }}</li>
      </ul>
    </details>
    <div class="compare__columns">
      <section class="compare__pane">
        <header class="compare__head">
          <h2>原版 Luckysheet · Cell</h2>
        </header>
        <iframe
          class="compare__frame"
          :src="originalDemoUrl"
          title="Luckysheet 原版 Demo"
          allow="clipboard-read; clipboard-write"
        />
      </section>
      <section class="compare__pane">
        <header class="compare__head">
          <h2>Luckysheet3 · Cell（同源数据）</h2>
        </header>
        <div class="compare__sheet">
          <LuckySheet :data="cellSheets" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
}
.compare__hint {
  margin: 0;
  color: #555;
  font-size: 12px;
  line-height: 1.4;
}
.compare__hint code {
  font-size: 11px;
}
.compare__gaps {
  font-size: 12px;
  color: #666;
}
.compare__gaps ul {
  margin: 4px 0 0;
  padding-left: 1.2rem;
}
.compare__columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
.compare__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.compare__head {
  padding: 6px 10px;
  border-bottom: 1px solid #eee;
  background: #f6f6f6;
}
.compare__head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.compare__frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  background: #fff;
}
.compare__sheet {
  flex: 1;
  min-height: 0;
}
</style>
