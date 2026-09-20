<script setup lang="ts">
import { ref } from "vue";
import { LuckySheet } from "@luckysheet3/vue";
import sheetMini from "../../../../fixtures/lucky/sheet-mini.json";

const ops = ref<string[]>([]);
const leftSel = ref("");
const rightSel = ref("");

function onOp(op: unknown) {
  ops.value.unshift(JSON.stringify(op));
  if (ops.value.length > 20) ops.value.pop();
}
</script>

<template>
  <div class="home">
    <p class="home__hint">
      同页两个 &lt;LuckySheet&gt; 实例，验证无全局 Store 污染。可编辑、撤销、输入
      <code>=SUM(A1:A3)</code>。
    </p>
    <div class="home__grid">
      <div class="home__pane">
        <h3>实例 A（fixture）</h3>
        <p class="meta">选区：{{ leftSel || "—" }}</p>
        <div class="sheet-wrap">
          <LuckySheet
            :data="[sheetMini]"
            @op="onOp"
            @selection-change="(s) => (leftSel = JSON.stringify(s))"
          />
        </div>
      </div>
      <div class="home__pane">
        <h3>实例 B（空白）</h3>
        <p class="meta">选区：{{ rightSel || "—" }}</p>
        <div class="sheet-wrap">
          <LuckySheet @selection-change="(s) => (rightSel = JSON.stringify(s))" />
        </div>
      </div>
    </div>
    <aside class="home__ops">
      <h4>协同 opcode（仅本地 emit，无 WebSocket）</h4>
      <pre v-for="(o, i) in ops" :key="i">{{ o }}</pre>
    </aside>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}
.home__hint {
  margin: 0;
  color: #555;
  font-size: 13px;
}
.home__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.home__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.home__pane h3 {
  margin: 0 0 4px;
  font-size: 14px;
}
.meta {
  margin: 0 0 4px;
  font-size: 12px;
  color: #888;
}
.sheet-wrap {
  flex: 1;
  min-height: 360px;
}
.home__ops {
  max-height: 120px;
  overflow: auto;
  border: 1px solid #eee;
  padding: 8px;
  background: #fafafa;
  font-size: 12px;
}
.home__ops h4 {
  margin: 0 0 4px;
}
.home__ops pre {
  margin: 0;
  font-size: 11px;
}
</style>
