/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Luckysheet3Core",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: [],
      output: {
        exports: "named",
      },
    },
    sourcemap: true,
    minify: false,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
  },
});
