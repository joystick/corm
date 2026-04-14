import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/mod.ts"),
        "components/index": resolve(__dirname, "src/components/mod.ts"),
        "cmi/index": resolve(__dirname, "src/cmi/mod.ts"),
        "sequencing/index": resolve(__dirname, "src/sequencing/mod.ts"),
        "assessment/index": resolve(__dirname, "src/assessment/mod.ts"),
        "store/index": resolve(__dirname, "src/store/mod.ts"),
        "sync/index": resolve(__dirname, "src/sync/mod.ts"),
        "shim/index": resolve(__dirname, "src/shim/mod.ts"),
        "audit/index": resolve(__dirname, "src/audit/mod.ts"),
        "styles/index": resolve(__dirname, "src/styles/mod.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "lit",
        "lit/decorators.js",
        "marked",
        "rxdb",
        "rxdb/plugins/storage-dexie",
        "rxdb/plugins/storage-memory",
        "rxdb/plugins/dev-mode",
        "rxdb/plugins/validate-ajv",
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: false, // Keep readable for debugging
  },
});
