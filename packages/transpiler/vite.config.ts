import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@corm/schema": resolve(__dirname, "../schema/src/mod.ts"),
      "@corm/scorm-parser": resolve(__dirname, "./src/parser/mod.ts"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        /^effect(\/.*)?$/,
        "jszip",
        "@xmldom/xmldom",
      ],
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
});
