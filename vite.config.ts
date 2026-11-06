import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

// Source lives in ./app; the build is a single self-contained index.html
// that scripts/publish.mjs copies to the repository root for GitHub Pages.
export default defineConfig({
  root: "app",
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./app/src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2022",
    cssCodeSplit: false,
  },
})
