import { copyFile, readdir, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const publicDir = path.join(root, "app", "public")

await copyFile(path.join(root, "app", "dist", "index.html"), path.join(root, "index.html"))

// Media referenced by the single-file page (the artwork loop and its poster)
// lives next to index.html so GitHub Pages serves it from the branch root.
for (const entry of await readdir(publicDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  await copyFile(path.join(publicDir, entry.name), path.join(root, entry.name))
}

await rm(path.join(root, "app", "dist"), { recursive: true, force: true })

console.log("Published app/dist/index.html and app/public assets to the repo root")
