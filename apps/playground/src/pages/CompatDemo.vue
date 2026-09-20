<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { luckysheet } from "@luckysheet3/compat";
import sheetMini from "../../../../fixtures/lucky/sheet-mini.json";

const log = ref("");

onMounted(() => {
  luckysheet.create({
    container: "luckysheet-compat",
    data: [sheetMini as never],
    onOp: (op) => {
      console.log("op", op);
    },
  });
});

onUnmounted(() => {
  luckysheet.destroy("luckysheet-compat");
});

function read() {
  log.value = String(luckysheet.getCellValue(0, 0));
}

function write() {
  luckysheet.setCellValue(0, 0, 99);
  read();
}
</script>

<template>
  <div class="compat">
    <p>
      旧式 <code>luckysheet.create / getCellValue / setCellValue</code>（尽力兼容，非完整 API）。
    </p>
    <div class="compat__actions">
      <button type="button" @click="read">getCellValue(0,0)</button>
      <button type="button" @click="write">setCellValue(0,0,99)</button>
      <span>{{ log }}</span>
    </div>
    <div id="luckysheet-compat" class="compat__host" />
  </div>
</template>

<style scoped>
.compat {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}
.compat__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.compat__host {
  flex: 1;
  min-height: 400px;
}
</style>
