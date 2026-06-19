import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "ChatEmi",
      cssFileName: "styles",
      fileName: (format) => (format === "umd" ? "chatemi.umd.cjs" : "chatemi.js"),
      formats: ["es", "umd"]
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        assetFileNames: (assetInfo) => (assetInfo.name === "style.css" ? "styles.css" : "assets/[name][extname]"),
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime"
        }
      }
    }
  }
});
