"use client"

import { useEffect, useRef } from "react"

type GridBackdropProps = {
  theme: "dark" | "light"
}

// Technical dot-matrix language: 8px pitch, 2px square dots, one violet accent.
const CELL = 8
const DOT = 2
const FLASHLIGHT_RADIUS = 160

// Only devices with a precise hover pointer get the custom crosshair cursor.
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)"

const PALETTE = {
  dark: {
    grid: "184, 151, 251",
    scrim: "9, 9, 11",
  },
  light: {
    grid: "109, 40, 217",
    scrim: "255, 255, 255",
  },
} as const

/**
 * Site-wide dot-matrix backdrop with a crosshair cursor.
 *
 * - A faint 8px grid of violet dots sits behind the page content (canvas, z-20).
 * - A circular flashlight reveals a brighter layer of the same dots around the
 *   pointer. Every dot is the same colour and size; only its distance from the
 *   pointer changes how bright it is.
 * - On fine-pointer devices the crosshair (a DOM element, z-50) replaces the
 *   native cursor over plain surfaces. Its centre is the exact hot spot, so
 *   clicks and hovers land where the crosshair is.
 * - Links, buttons, form controls and text keep their native cursor (hand or
 *   I-beam) and the crosshair steps aside, so hovering and selecting text feel
 *   like a normal website.
 */
export default function GridBackdrop({ theme }: GridBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const armsRef = useRef<SVGGElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const cursor = cursorRef.current
    const arms = armsRef.current
    const label = labelRef.current

    if (!canvas || !ctx || !cursor || !arms || !label) return

    const palette = PALETTE[theme]
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const finePointer = window.matchMedia(FINE_POINTER_QUERY)

    let reduceMotion = motionQuery.matches
    let width = 0
    let height = 0
    let lastFrame = performance.now()
    let frame = 0

    const pointer = { x: 0, y: 0, active: false, reveal: 0 }
    let pressed = false
    let pointerVisible = false
    let crosshairShown = false
    let nativeCursor = false
    let lastCell = ""

    // Computed cursor styles are only read when the element under the pointer
    // changes, so a pointer move costs at most one style read.
    let probedElement: Element | null = null
    let probedNative = false

    const base = document.createElement("canvas")
    const baseCtx = base.getContext("2d")

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)

      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (!baseCtx) return

      base.width = canvas.width
      base.height = canvas.height
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      baseCtx.clearRect(0, 0, width, height)
      baseCtx.fillStyle = `rgba(${palette.grid}, ${theme === "dark" ? 0.08 : 0.06})`

      for (let x = CELL / 2; x < width; x += CELL) {
        for (let y = CELL / 2; y < height; y += CELL) {
          baseCtx.fillRect(x - DOT / 2, y - DOT / 2, DOT, DOT)
        }
      }
    }

    // The crosshair is only shown when there is no native cursor to defer to.
    const applyCursorState = () => {
      const visible = pointerVisible && finePointer.matches && !nativeCursor

      if (visible === crosshairShown) return

      crosshairShown = visible
      cursor.style.opacity = visible ? "1" : "0"
    }

    // The arms shrink while the mouse button is held.
    const applyArmScale = () => {
      arms.style.transform = `scale(${pressed ? 0.8 : 1})`
    }

    // The stylesheet is the single source of truth: any element that keeps a
    // visible cursor (links, buttons, form controls, text) also keeps it here,
    // and the crosshair hides instead of stacking on top of it.
    const usesNativeCursor = (hit: Element | null) => {
      if (!hit) return false
      if (hit === probedElement) return probedNative

      probedElement = hit
      probedNative = window.getComputedStyle(hit).cursor !== "none"

      return probedNative
    }

    // Moves the crosshair to the pointer and refreshes its state. The DOM
    // writes only happen when something actually changes.
    const updateCursor = () => {
      cursor.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`

      const hit = document.elementFromPoint(pointer.x, pointer.y)
      const native = usesNativeCursor(hit)

      if (native !== nativeCursor) {
        nativeCursor = native
        applyCursorState()
      }

      const cell = `${Math.floor(pointer.x / CELL)}:${Math.floor(pointer.y / CELL)}`

      if (cell !== lastCell) {
        lastCell = cell
        label.textContent = cell
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = true
      pointerVisible = true
      updateCursor()
      applyCursorState()
    }

    const onPointerDown = (event: PointerEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = true
      pointerVisible = true
      pressed = true
      applyArmScale()
      updateCursor()
    }

    const onPointerUp = (event: PointerEvent) => {
      pressed = false
      applyArmScale()

      if (event.pointerType !== "mouse") onPointerLeave()
    }

    const onPointerLeave = () => {
      pointer.active = false
      pressed = false
      pointerVisible = false
      nativeCursor = false
      probedElement = null
      applyArmScale()
      applyCursorState()
    }

    // Keeps the cursor state correct when the page scrolls under a stationary
    // pointer.
    const onScroll = () => {
      if (pointer.active) updateCursor()
    }

    const drawScrim = (radius: number) => {
      const gradient = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        radius * 0.12,
        pointer.x,
        pointer.y,
        radius,
      )

      gradient.addColorStop(0, `rgba(${palette.scrim}, ${0.8 * pointer.reveal})`)
      gradient.addColorStop(0.72, `rgba(${palette.scrim}, ${0.55 * pointer.reveal})`)
      gradient.addColorStop(1, `rgba(${palette.scrim}, 0)`)
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawGrid = (radius: number, reveal: number) => {
      const cx = pointer.x
      const cy = pointer.y
      const startX = Math.max(0, Math.floor((cx - radius) / CELL) * CELL)
      const startY = Math.max(0, Math.floor((cy - radius) / CELL) * CELL)
      const endX = Math.min(width, cx + radius)
      const endY = Math.min(height, cy + radius)

      for (let gridX = startX; gridX < endX; gridX += CELL) {
        for (let gridY = startY; gridY < endY; gridY += CELL) {
          const x = gridX + CELL / 2
          const y = gridY + CELL / 2
          const dx = x - cx
          const dy = y - cy
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance > radius) continue

          const falloff = 1 - distance / radius
          const alpha = Math.pow(falloff, 0.4) * reveal * 0.85

          ctx.fillStyle = `rgba(${palette.grid}, ${alpha})`
          ctx.fillRect(x - DOT / 2, y - DOT / 2, DOT, DOT)
        }
      }
    }

    const render = (now: number) => {
      const delta = Math.min(0.05, (now - lastFrame) / 1000)

      lastFrame = now
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(base, 0, 0, width, height)

      // Reduced motion keeps the reveal, but turns it on and off instantly
      // instead of easing it.
      const target = pointer.active ? 1 : 0

      pointer.reveal +=
        (target - pointer.reveal) * (reduceMotion ? 1 : Math.min(1, delta * 8))

      if (pointer.reveal > 0.01 && width > 0 && height > 0) {
        const baseRadius = Math.min(FLASHLIGHT_RADIUS, Math.min(width, height) * 0.32)
        const radius = baseRadius * (0.6 + 0.4 * pointer.reveal)

        drawScrim(radius)
        drawGrid(radius, pointer.reveal)
      }

      frame = requestAnimationFrame(render)
    }

    const onMotionChange = () => {
      reduceMotion = motionQuery.matches
    }

    resize()
    applyArmScale()

    // The effect restarts on theme change. Hide any crosshair left over from the
    // previous run: the pointer has to move again before it is shown.
    cursor.style.opacity = "0"
    crosshairShown = false
    nativeCursor = false
    pointerVisible = false

    const observer = new ResizeObserver(resize)

    observer.observe(document.documentElement)
    motionQuery.addEventListener("change", onMotionChange)
    window.addEventListener("resize", resize)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerdown", onPointerDown, { passive: true })
    window.addEventListener("pointerup", onPointerUp, { passive: true })
    window.addEventListener("blur", onPointerLeave)
    document.documentElement.addEventListener("pointerleave", onPointerLeave)

    frame = requestAnimationFrame((now) => {
      lastFrame = now
      render(now)
    })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      motionQuery.removeEventListener("change", onMotionChange)
      window.removeEventListener("resize", resize)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("blur", onPointerLeave)
      document.documentElement.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [theme])

  const palette = PALETTE[theme]

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-20">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <div
        ref={cursorRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-50 opacity-0 transition-opacity duration-150 will-change-transform"
        style={{
          color: `rgb(${palette.grid})`,
          filter: "drop-shadow(0 0 1px rgb(0 0 0 / 0.5))",
        }}
      >
        <svg
          className="absolute -top-6 -left-6 overflow-visible"
          width="48"
          height="48"
          viewBox="-24 -24 48 48"
        >
          <g
            ref={armsRef}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            style={{ transition: "transform 120ms ease-out" }}
          >
            <path d="M-24 0H-6M6 0H24M0 -24V-6M0 6V24" />
          </g>
          <rect x="-1" y="-1" width="2" height="2" fill={`rgb(${palette.grid})`} />
        </svg>
        <span
          ref={labelRef}
          className="absolute top-4 left-7 font-mono text-[10px] leading-none whitespace-nowrap"
        />
      </div>
    </>
  )
}
