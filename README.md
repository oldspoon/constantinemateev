# oldspoon.github.io

Personal site: a monospace CV panel next to a live Paper Shaders dither field.
Rebuilt on a React + TypeScript + Tailwind stack with a shadcn-compatible
structure. Content is based only on the previous site; the name and contact
details are anonymized to the `oldspoon` handle, while each project keeps its
real `(demo)` / `(source)` links.

## Stack

- React 19 + TypeScript, built with Vite 7
- Tailwind CSS v4 (`@tailwindcss/vite`, no `tailwind.config.js`)
- shadcn/ui layout: `components.json`, `@/` alias, `components/ui`, `lib/utils`
- [`@paper-design/shaders-react`](https://www.npmjs.com/package/@paper-design/shaders-react)
  for the WebGL dither panel, `lucide-react` for icons

## Commands

```bash
npm install
npm run dev        # local dev server (http://localhost:5173)
npm run build      # typecheck, build, and publish a single-file index.html
npm run preview    # preview the built file
npm run typecheck  # tsc --noEmit
```

`npm run build` writes `app/dist/index.html` and then copies it to the repo
root. GitHub Pages serves the root `index.html`, so the deployed site is one
self-contained file (JS and CSS inlined) with no build step on the server.

## Source layout

```
app/
  index.html            # page shell, meta, favicon links, theme bootstrap
  src/
    main.tsx            # React entry
    App.tsx             # renders the hero
    index.css           # Tailwind import + base styles
    components/ui/
      portfolio-hero-with-paper-shaders.tsx
      grid-backdrop.tsx     # site-wide dot grid + flashlight
    lib/utils.ts        # cn() helper used by shadcn components
components.json         # shadcn CLI config
vite.config.ts          # root: app, single-file output, @ alias
```

### Why `components/ui` and the `@/` alias

shadcn/ui's CLI and the components it generates assume:

- components live in `components/ui`, imported as `@/components/ui/<name>`
- the `cn()` helper lives in `lib/utils`, imported as `@/lib/utils`
- the Tailwind entry stylesheet is declared in `components.json`

Because the Vite root is `app/`, those folders are `app/src/components/ui` and
`app/src/lib/utils.ts`. The `@/*` alias in `tsconfig.json` and
`vite.config.ts` maps to `app/src/*`, so generated code resolves exactly as
shadcn expects. Keep new UI primitives in `app/src/components/ui/` and add
global styles/tokens to `app/src/index.css`.

Adding more shadcn components:

```bash
npx shadcn@latest add button
npm run build
```

The CLI reads `components.json` (style, CSS path, aliases) and writes into
`app/src/components/ui`.

## The shader panel

`Dithering` is a client-only WebGL component. It rotates slowly (4°/s),
respects `prefers-reduced-motion` (rotation and shader motion stop, static
frame remains) and the colors follow the theme toggle. On narrow screens the
panel moves above the CV text and keeps a fixed 38vh height.

### Site-wide grid

`components/ui/grid-backdrop.tsx` is a fixed, full-viewport canvas (z-20,
`pointer-events: none`) that sits over the whole page, so the CV text, the
project list and the shader panel all share one grid:

- a faint, always-on 8px dot grid (2px square pixels), white on near-black and
  inverted for the light theme;
- a circular flashlight that follows the pointer anywhere on the site and
  reveals a brighter layer through a soft scrim, with a hairline ring and a
  crosshair that labels the current grid cell;
- square pixels that lift off grid points as the pointer moves and fall under
  gravity, plus falling 1px dash marks in the revealed columns.

Content sits above the backdrop (`z-30`) and clicks pass straight through
it. The canvas is capped at ~220 particles and 22 dashes, and
`prefers-reduced-motion` turns off splashes, dashes and rotation while keeping
the flashlight reveal.

## Deployment

Push to `main`. GitHub Pages is configured to serve from the branch root, so
only the generated root `index.html` plus `favicon*`, `apple-touch-icon.png`
and `robots.txt` need to be present. `node_modules/`, `.vite/` and `app/dist/`
are ignored.
