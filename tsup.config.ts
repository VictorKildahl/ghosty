import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/main/main.ts",
    "src/main/preload.ts",
    "src/main/overlayPreload.ts",
  ],
  outDir: "dist",
  format: ["cjs"],
  target: "node18",
  sourcemap: true,
  clean: true,
  external: ["electron", "uiohook-napi"],
});
