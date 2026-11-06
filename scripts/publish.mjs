import { copyFile, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const built = path.join(root, "app", "dist", "index.html")

await copyFile(built, path.join(root, "index.html"))
await rm(path.join(root, "app", "dist"), { recursive: true, force: true })

console.log("Published app/dist/index.html -> index.html")
