# oldspoon.github.io

Personal site: a monospace CV panel next to a looping artwork video.
Rebuilt on a React + TypeScript + Tailwind stack with a shadcn-compatible
structure. Content is based only on the previous site; the name and contact
details are anonymized to the `oldspoon` handle, while each project keeps its
real `(demo)` / `(source)` links.

Build history, design decisions and deploy notes are in
[`docs/how-it-was-built.md`](docs/how-it-was-built.md).

## Stack

- React 19 + TypeScript, built with Vite 7
- Tailwind CSS v4 (`@tailwindcss/vite`, no `tailwind.config.js`)
- shadcn/ui layout: `components.json`, `@/` alias, `components/ui`, `lib/utils`
- `lucide-react` for icons; the right-hand panel is a plain `<video>` loop

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
      portfolio-hero.tsx    # CV panel, theme toggle, artwork video
      grid-backdrop.tsx     # site-wide dot grid + cursor
  public/
    artwork.mp4           # 11s portrait loop for the right-hand panel
    artwork-poster.jpg    # its first frame, used as the video poster
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

## The artwork panel

The right-hand half is a looping video of the artwork: a 720x1280, 11 second
H.264 loop (`app/public/artwork.mp4`) with a slow zoom that returns to its
start, so the loop has no visible seam. It is muted, inline and autoplayed,
with the first frame (`artwork-poster.jpg`) as the poster so the panel is never
empty, even if playback is blocked. `prefers-reduced-motion: reduce` pauses it
on the first frame. On narrow screens the panel moves above the CV text and
keeps a fixed 38vh height, cropped with `object-fit: cover`.

The source frame was 300x559, so the loop is upscaled; `scripts/publish.mjs`
copies both files to the repo root next to `index.html` because the page is
built as a single file and the video is too large to inline.

### Site-wide grid

`components/ui/grid-backdrop.tsx` is a fixed, full-viewport canvas (z-20,
`pointer-events: none`) that sits over the whole page, so the CV text, the
project list and the artwork panel all share one grid:

- a faint, always-on 8px dot grid of 2px square pixels in the violet accent
  (`#B897FB` on near-black, `#6D28D9` on white);
- a circular flashlight that follows the pointer anywhere on the site and
  reveals a brighter layer of the same dots through a soft scrim;
- a bubble: while the pointer moves, the dots around it bulge outwards and
  settle back into the grid when it stops.

Every dot is the same colour and size. Only the distance from the pointer
changes how bright a dot is, so there are no random accents and no particles
or spark effects. Content sits above the backdrop (`z-30`) and clicks pass
straight through it.

### Crosshair cursor

On fine-pointer devices the crosshair is the cursor, everywhere and at all
times: `app/src/index.css` sets `cursor: none !important` on `html` and every
descendant, so no element or user-agent style can bring the native cursor
back. Its centre is the hot spot, so clicks land where it points. It opens up
over links and buttons (arms scale to 1.35), shrinks while the mouse is
pressed, and labels the grid cell under the pointer. Touch devices are not
affected. See
[`docs/how-it-was-built.md`](docs/how-it-was-built.md#cursor) for details.
`prefers-reduced-motion` turns off the bubble and the artwork loop, and
switches the flashlight on and off instantly instead of easing it.

### Project links

A project in the list is plain text; only `(demo)` and `(source)` are links.
The project name does not link anywhere, so the list has exactly one link per
reachable destination.

## Deployment

Push to `main`. GitHub Pages is configured to serve from the branch root, so
only the generated root `index.html` plus `favicon*`, `apple-touch-icon.png`
and `robots.txt` need to be present. `node_modules/`, `.vite/` and `app/dist/`
are ignored.
