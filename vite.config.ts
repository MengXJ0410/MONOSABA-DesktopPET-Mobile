import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve("src"),
      // 和桌面端保持一致：直接使用 Pixi 的单文件 ESM，避免内部模块分块产生循环依赖。
      "pixi.js": resolve("node_modules/pixi.js/dist/pixi.mjs"),
    },
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2020",
  },
});
