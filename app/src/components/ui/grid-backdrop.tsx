"use client"

import { useEffect, useRef } from "react"

type GridBackdropProps = {
  theme: "dark" | "light"
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

type Streak = {
  x: number
  y: number
  length: number
  speed: number
  color: string
}

// Technical dot-matrix language: 8px pitch, 2px square dots, near-black,
// white + violet, with coral used only as a rare accent.
const CELL = 8
const DOT = 2
const FLASHLIGHT_RADIUS = 160
const GRAVITY = 1500
const MAX_PARTICLES = 220
const MAX_STREAKS = 22

// Elements that get the "interactive" crosshair state when hovered.
const INTERACTIVE_SELECTOR =
  'a[href], button, [role="button"], input, select, textarea, label, [data-cursor="interactive"]'

// Only devices with a precise hover pointer get the custom crosshair cursor.
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)"

const PALETTE = {
  dark: {
    base: "255, 255, 255",
    core: "255, 255, 255",
    violet: "184, 151, 251",
    coral: "246, 84, 62",
  },
  light: {
    base: "9, 9, 11",
    core: "9, 9, 11",
    violet: "109, 40, 217",
    coral: "225, 56, 40",
  },
} as const

function snap(value: number) {
  return Math.round(value / CELL) * CELL + CELL / 2
}

function hash(x: number, y: number) {
  let value = Math.imul(x * 73856093 ^ y * 19349663 ^ 83492791, 1540483477)

  value ^= value >>> 13
  value = Math.imul(value, 1540483477)
  value ^= value >>> 15

  return (value >>> 0) / 4294967296
}

/**
 * Site-wide dot-matrix backdrop with a crosshair cursor.
 *
 * - A faint 8px dot grid sits behind the page content (canvas, z-20).
 * - A circular flashlight reveals a brighter grid layer around the pointer.
 * - The native cursor is hidden on fine-pointer devices (see index.css) and
 *   the crosshair (a DOM element, z-50) is the pointer. Its centre is the
 *   exact hot spot, so clicks and hovers land where the crosshair is.
 * - Over links and buttons the crosshair opens up and gets a "pressed" state
 *   on mouse down. Its label shows the grid cell under the pointer.
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
    let elapsed = 0
    let lastFrame = performance.now()
    let frame = 0
    let particles: Particle[] = []
    let streaks: Streak[] = []
    let streakClock = 0

    const pointer = { x: 0, y: 0, active: false, reveal: 0, burst: 0 }
    let overInteractive = false
    let pressed = false
    let cursorVisible = false
    let lastCell = ""

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
      baseCtx.fillStyle = `rgba(${palette.base}, ${theme === "dark" ? 0.06 : 0.04})`

      for (let x = CELL / 2; x < width; x += CELL) {
        for (let y = CELL / 2; y < height; y += CELL) {
          baseCtx.fillRect(x - DOT / 2, y - DOT / 2, DOT, DOT)
        }
      }
    }

    // Crosshair arms scale with state: 1 idle, 1.35 over an interactive
    // element, 0.8 while the mouse button is held.
    const applyArmScale = () => {
      const scale = pressed ? 0.8 : overInteractive ? 1.35 : 1

      arms.style.transform = `scale(${scale})`
    }

    const setCursorVisible = (visible: boolean) => {
      const next = visible && finePointer.matches

      if (next === cursorVisible) return
      cursorVisible = next
      cursor.style.opacity = next ? "1" : "0"
    }

    // Moves the crosshair to the pointer and refreshes its state. The DOM
    // writes only happen when something actually changes.
    const updateCursor = () => {
      cursor.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`

      const hit = document.elementFromPoint(pointer.x, pointer.y)
      const interactive = !!hit?.closest(INTERACTIVE_SELECTOR)

      if (interactive !== overInteractive) {
        overInteractive = interactive
        applyArmScale()
      }

      const cell = `${Math.floor(pointer.x / CELL)}:${Math.floor(pointer.y / CELL)}`

      if (cell !== lastCell) {
        lastCell = cell
        label.textContent = cell
      }
    }

    const spawn = (count: number) => {
      if (reduceMotion) return

      for (let index = 0; index < count; index += 1) {
        if (particles.length >= MAX_PARTICLES) return

        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * FLASHLIGHT_RADIUS * 0.5
        const speed = 50 + Math.random() * 170
        const life = 0.55 + Math.random() * 0.6
        const roll = Math.random()

        particles.push({
          x: snap(pointer.x + Math.cos(angle) * distance),
          y: snap(pointer.y + Math.sin(angle) * distance),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 70 - Math.random() * 120,
          life,
          maxLife: life,
          size: roll > 0.94 ? 5 : roll > 0.72 ? 3 : DOT,
          color: roll < 0.14 ? palette.violet : roll > 0.94 ? palette.coral : palette.core,
        })
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y)

      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = true
      setCursorVisible(true)
      updateCursor()

      if (distance < 0.5) return

      pointer.burst = Math.min(1, pointer.burst + distance / 140 + 0.06)
      spawn(Math.min(8, Math.max(2, Math.round(distance / 6))))
    }

    const onPointerDown = (event: PointerEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = true
      pointer.burst = 1
      pressed = true
      setCursorVisible(true)
      updateCursor()
      applyArmScale()
      spawn(16)
    }

    const onPointerUp = (event: PointerEvent) => {
      pressed = false
      applyArmScale()

      if (event.pointerType !== "mouse") onPointerLeave()
    }

    const onPointerLeave = () => {
      pointer.active = false
      pressed = false
      setCursorVisible(false)
      applyArmScale()
    }

    // Keeps the interactive state correct when the page scrolls under a
    // stationary pointer.
    const onScroll = () => {
      if (pointer.active) updateCursor()
    }

    const drawScrim = (radius: number) => {
      const scrim = theme === "dark" ? "9, 9, 11" : "255, 255, 255"
      const gradient = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        radius * 0.12,
        pointer.x,
        pointer.y,
        radius,
      )

      gradient.addColorStop(0, `rgba(${scrim}, ${0.8 * pointer.reveal})`)
      gradient.addColorStop(0.72, `rgba(${scrim}, ${0.55 * pointer.reveal})`)
      gradient.addColorStop(1, `rgba(${scrim}, 0)`)
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

          const column = Math.round(gridX / CELL)
          const row = Math.round(gridY / CELL)
          const falloff = 1 - distance / radius
          const roll = hash(column, row)
          const alpha =
            (0.42 + 0.54 * hash(column + 11, row + 7)) * Math.pow(falloff, 0.3) * reveal
          const size = roll > 0.965 || roll < 0.035 ? 3 : DOT
          const tone = roll < 0.16 ? palette.violet : roll > 0.982 ? palette.coral : palette.core
          const push = pointer.burst * 14 * falloff
          const safeDistance = distance || 1

          ctx.fillStyle = `rgba(${tone}, ${alpha})`
          ctx.fillRect(
            x + (dx / safeDistance) * push - size / 2,
            y + (dy / safeDistance) * push - size / 2,
            size,
            size,
          )
        }
      }
    }

    const drawStreaks = (radius: number, reveal: number, delta: number) => {
      if (!reduceMotion) {
        streakClock += delta

        if (streakClock > 0.12) {
          streakClock = 0

          if (streaks.length < MAX_STREAKS) {
            const column = Math.floor((Math.random() * 2 * radius) / CELL)
            const startX = pointer.x - radius + column * CELL + CELL / 2

            streaks.push({
              x: startX,
              y: pointer.y - radius,
              length: 5 + Math.floor(Math.random() * 9),
              speed: 60 + Math.random() * 120,
              color: Math.random() < 0.22 ? palette.violet : palette.core,
            })
          }
        }

        for (const streak of streaks) streak.y += streak.speed * delta

        streaks = streaks.filter((streak) => streak.y < pointer.y + radius)
      }

      for (const streak of streaks) {
        const distance = Math.hypot(streak.x - pointer.x, streak.y - pointer.y)

        if (distance > radius) continue

        const alpha = (1 - distance / radius) * reveal * 0.85

        ctx.fillStyle = `rgba(${streak.color}, ${alpha})`
        ctx.fillRect(streak.x - 0.5, streak.y, 1, streak.length)
      }
    }

    const render = (now: number) => {
      const delta = Math.min(0.05, (now - lastFrame) / 1000)

      lastFrame = now
      if (!reduceMotion) elapsed += delta
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(base, 0, 0, width, height)

      pointer.reveal += ((pointer.active ? 1 : 0) - pointer.reveal) * Math.min(1, delta * 8)
      pointer.burst *= Math.max(0, 1 - delta * 3.5)

      if (pointer.reveal > 0.01 && width > 0 && height > 0) {
        const baseRadius = Math.min(FLASHLIGHT_RADIUS, Math.min(width, height) * 0.32)
        const radius = baseRadius * (0.6 + 0.4 * pointer.reveal)

        drawScrim(radius)
        drawGrid(radius, pointer.reveal)
        drawStreaks(radius, pointer.reveal, delta)
      } else {
        streaks = []
      }

      let alive = 0

      for (const particle of particles) {
        particle.life -= delta

        if (particle.life <= 0) continue

        particle.vy += GRAVITY * delta
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        particle.vx *= Math.max(0, 1 - delta * 0.8)

        const progress = particle.life / particle.maxLife
        const alpha = Math.min(1, progress * 1.6)

        ctx.fillStyle = `rgba(${particle.color}, ${alpha})`
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
        particles[alive] = particle
        alive += 1
      }

      particles = particles.slice(0, alive)
      frame = requestAnimationFrame(render)
    }

    const onMotionChange = () => {
      reduceMotion = motionQuery.matches

      if (reduceMotion) {
        particles = []
        streaks = []
        pointer.burst = 0
      }
    }

    resize()
    applyArmScale()

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
          color: `rgb(${palette.violet})`,
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
          <rect x="-1" y="-1" width="2" height="2" fill={`rgb(${palette.coral})`} />
        </svg>
        <span
          ref={labelRef}
          className="absolute top-4 left-7 font-mono text-[10px] leading-none whitespace-nowrap"
        />
      </div>
    </>
  )
}
