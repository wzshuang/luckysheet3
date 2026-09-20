import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@luckysheet3/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@luckysheet3/vue": resolve(__dirname, "../../packages/vue/src/index.ts"),
      "@luckysheet3/compat": resolve(__dirname, "../../packages/compat/src/index.ts"),
    },
  },
  server: {
    port: 5173,
  },
});
