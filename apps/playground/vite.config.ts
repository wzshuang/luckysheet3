import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const playgroundDir = fileURLToPath(new URL(".", import.meta.url));
/** Sibling repo: github.com/LuckysheetDemo */
const luckysheetDemoRoot = resolve(playgroundDir, "../../../LuckysheetDemo");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

function serveLuckysheetDemo(basePath: string): Plugin {
  const mount = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

  const handler = (
    req: import("http").IncomingMessage,
    res: import("http").ServerResponse,
    next: () => void,
  ) => {
    if (!req.url?.startsWith(mount)) {
      next();
      return;
    }
    let rel = req.url.slice(mount.length).split("?")[0] || "/";
    if (rel === "/") rel = "/index.html";
    const filePath = path.normalize(path.join(luckysheetDemoRoot, rel));
    if (!filePath.startsWith(luckysheetDemoRoot)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end(`Not found: ${rel}`);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
      res.end(data);
    });
  };

  return {
    name: "serve-luckysheet-demo",
    configureServer(server) {
      if (!fs.existsSync(luckysheetDemoRoot)) {
        console.warn(
          `[playground] LuckysheetDemo not found at ${luckysheetDemoRoot} — iframe 将无法加载原版`,
        );
        return;
      }
      console.log(`[playground] 原版 Demo: http://localhost:${server.config.server.port}${mount}/index.html`);
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      if (fs.existsSync(luckysheetDemoRoot)) {
        server.middlewares.use(handler);
      }
    },
  };
}

export default defineConfig({
  plugins: [vue(), serveLuckysheetDemo("/luckysheet-original")],
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
