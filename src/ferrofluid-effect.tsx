"use client"

import { useEffect, useRef } from "react"

const BAYER_8X8 = [
  [ 0/64, 32/64,  8/64, 40/64,  2/64, 34/64, 10/64, 42/64],
  [48/64, 16/64, 56/64, 24/64, 50/64, 18/64, 58/64, 26/64],
  [12/64, 44/64,  4/64, 36/64, 14/64, 46/64,  6/64, 38/64],
  [60/64, 28/64, 52/64, 20/64, 62/64, 30/64, 54/64, 22/64],
  [ 3/64, 35/64, 11/64, 43/64,  1/64, 33/64,  9/64, 41/64],
  [51/64, 19/64, 59/64, 27/64, 49/64, 17/64, 57/64, 25/64],
  [15/64, 47/64,  7/64, 39/64, 13/64, 45/64,  5/64, 37/64],
  [63/64, 31/64, 55/64, 23/64, 61/64, 29/64, 53/64, 21/64]
]

const DEMON_PALETTE = [
  { name: 'Electric Cyan', r: 0, g: 240, b: 255 },
  { name: 'Azure Flame', r: 0, g: 140, b: 255 },
  { name: 'Phantom Indigo', r: 80, g: 0, b: 220 },
  { name: 'Cobalt Flame', r: 0, g: 80, b: 255 }
]

function combineDemonColors(c1: { r: number, g: number, b: number }, c2: { r: number, g: number, b: number }, w1 = 1, w2 = 1) {
  const totalW = w1 + w2;
  const mixR = Math.round((c1.r * w1 + c2.r * w2) / totalW);
  const mixG = Math.round((c1.g * w1 + c2.g * w2) / totalW);
  const mixB = Math.round((c1.b * w1 + c2.b * w2) / totalW);
  return { r: mixR, g: mixG, b: mixB };
}

interface FerrofluidEffectProps {
  element: 'water' | 'air' | 'fire' | 'earth' | 'none'
  className?: string
  preview?: boolean
  splashKey?: number
}

export function FerrofluidEffect({ element = 'water', className, preview = false, splashKey = 0 }: FerrofluidEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePosRef = useRef({ x: -1000, y: -1000 }) // Start off-screen
  const prevMousePosRef = useRef({ x: -1000, y: -1000 })
  const mouseVelocityRef = useRef({ x: 0, y: 0 })
  const animationRef = useRef<number | null>(null)
  const hasMouseMovedRef = useRef(false) // Track if mouse has actually moved
  const lastRockSpawnTimeRef = useRef(0) // Cooldown for rock throwing
  const storedRockVelocityRef = useRef({ x: 0, y: 0 }) // Store velocity for delayed rock spawn
  const passivePhaseRef = useRef(0) // Phase for passive (none) animation emitter
  // Image sampling refs for 'none' pixel-art effect
  const imgRef = useRef<HTMLImageElement | null>(null)
  const pixelColorsRef = useRef<Uint8ClampedArray | null>(null) // length = cols*rows*4
  const sampledDimsRef = useRef({ w: 0, h: 0 })
  // Hover state for revealing full image when element === 'none'
  const hoveredRef = useRef(false)
  // Fixed center for hover reveal to prevent shifting
  const hoverCenterRef = useRef<{ x: number, y: number } | null>(null)
  // Randomly selected lore image path
  const chosenImagePathRef = useRef<string | null>(null)
  // Smooth reveal progress (0 -> blob, 1 -> full pixel mosaic)
  const revealTRef = useRef(0)
  // Preview rain intensity (1 = full rain, 0 = no rain)
  const rainIntensityRef = useRef(preview ? 1 : 0)
  // Track when mouse last left for delayed rain resume
  const lastMouseLeaveTimeRef = useRef(0)
  // Shared animation time for event handlers
  const animTimeRef = useRef(0)
  // Splash animation state
  const splashRef = useRef<{ active: boolean; startTime: number; duration: number } | null>(null)

  // Trigger splash animation when splashKey changes
  useEffect(() => {
    if (splashKey <= 0) return
    splashRef.current = { active: true, startTime: -1, duration: 2.0 }
  }, [splashKey])

  // Reset earth cooldown when earth element is selected
  useEffect(() => {
    if (element === 'earth') {
      lastRockSpawnTimeRef.current = 0
    }
  }, [element])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Dynamic brand color fetching (original blog look)
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#cbf5ff'

    const checkIsMobile = () => {
      if (typeof window === 'undefined') return false
      return window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Twitter|FBAN|FBAV/i.test(navigator.userAgent || '')
    }

    let cssWidth = 0
    let cssHeight = 0
    let dpr = 1

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect() || canvas.getBoundingClientRect()
      const isMobile = checkIsMobile()
      dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2)
      cssWidth = rect.width || window.innerWidth || 360
      cssHeight = rect.height || window.innerHeight || 240
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Set touch-action on the parent to control scrolling based on the active element
    const parentElement = canvas.parentElement as HTMLElement | null

    let resizeObserver: ResizeObserver | null = null
    if (parentElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas()
      })
      resizeObserver.observe(parentElement)
    }

    const initTimer = setTimeout(resizeCanvas, 350)

    // Unified pointer tracking with velocity calculation
    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!canvas) return
      const container = (canvas.parentElement as HTMLElement) ?? canvas
      const rect = container.getBoundingClientRect()
      const newMousePos = {
        x: clientX - rect.left,
        y: clientY - rect.top
      }

      // Initialize positions on first pointer movement
      if (!hasMouseMovedRef.current) {
        hasMouseMovedRef.current = true
        mousePosRef.current = newMousePos
        prevMousePosRef.current = newMousePos
        mouseVelocityRef.current = { x: 0, y: 0 }
        return
      }

      // Calculate pointer velocity for physics
      mouseVelocityRef.current = {
        x: newMousePos.x - prevMousePosRef.current.x,
        y: newMousePos.y - prevMousePosRef.current.y
      }

      prevMousePosRef.current = { ...mousePosRef.current }
      mousePosRef.current = newMousePos
    }

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        // Set hasMouseMoved to true and initialize positions on touch start
        // This prevents a jump if the mouse was previously elsewhere
        hasMouseMovedRef.current = true
        const touch = e.touches[0]
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const newMousePos = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        }
        mousePosRef.current = newMousePos
        prevMousePosRef.current = newMousePos
        mouseVelocityRef.current = { x: 0, y: 0 }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    // Listen to mouse and touch events on parent element
    const handleMouseEnter = () => {
      hoveredRef.current = true
      // Lock reveal center to current mouse grid cell (fallback to canvas center)
      const mx = mousePosRef.current.x
      const my = mousePosRef.current.y
      const isMouseValid = mx >= 0 && my >= 0 && mx !== Infinity && my !== Infinity
      const cx = isMouseValid ? Math.floor(mx / pixelSize) : Math.floor((cssWidth * 0.5) / pixelSize)
      const cy = isMouseValid ? Math.floor(my / pixelSize) : Math.floor((cssHeight * 0.5) / pixelSize)
      hoverCenterRef.current = { x: cx, y: cy }
    }
    const handleMouseLeave = () => {
      hoveredRef.current = false
      hoverCenterRef.current = null
      if (preview) {
        lastMouseLeaveTimeRef.current = animTimeRef.current
      }
    }
    if (parentElement) {
      parentElement.addEventListener('mousemove', handleMouseMove)
      parentElement.addEventListener('touchstart', handleTouchStart, { passive: true })
      parentElement.addEventListener('touchmove', handleTouchMove, { passive: true })
      parentElement.addEventListener('mouseenter', handleMouseEnter)
      parentElement.addEventListener('mouseleave', handleMouseLeave)
    }

    // Grid settings for fluid rendering
    const basePixelSize = 17
    const nonePixelSize = 10 // smaller = higher density for clearer image in 'none' mode
    const previewPixelSize = 6
    const pixelSize = preview ? previewPixelSize : element === 'none' ? nonePixelSize : basePixelSize
    let cols = Math.ceil(cssWidth / pixelSize)
    let rows = Math.ceil(cssHeight / pixelSize)

    // Load image once for pixel-art coloring in 'none' mode
    if (element === 'none' && !imgRef.current) {
      // Shuffle between lore images on page load
      const loreImages = [
        '/lore/american gothic.jpg',
        '/lore/the kiss.jpg'
      ]
      if (!chosenImagePathRef.current) {
        chosenImagePathRef.current = loreImages[Math.floor(Math.random() * loreImages.length)]
      }
      const img = new Image()
      img.loading = 'eager'
      img.decoding = 'sync'
      img.fetchPriority = 'high'
      img.src = chosenImagePathRef.current
      img.onload = () => {
        imgRef.current = img
        // Defer sampling to animate where cols/rows are current
      }
    }

    // Helper to resample image to current grid resolution
    const resampleImageToGrid = () => {
      if (!imgRef.current) return
      const img = imgRef.current
      // Create an offscreen canvas sized to grid cells
      const off = document.createElement('canvas')
      off.width = Math.max(1, cols)
      off.height = Math.max(1, rows)
      const octx = off.getContext('2d')
      if (!octx) return
      // Draw with smoothing off for crisp pixel sampling
      octx.imageSmoothingEnabled = false
      octx.clearRect(0, 0, off.width, off.height)
      // Compute cover-fit to preserve aspect and fill grid
      const gridAspect = off.width / off.height
      const imgAspect = img.width / img.height
      let dw = off.width, dh = off.height, dx = 0, dy = 0
      if (imgAspect > gridAspect) {
        // Image wider: fit height, crop sides
        dh = off.height
        dw = Math.round(dh * imgAspect)
        dx = Math.round((off.width - dw) / 2)
        dy = 0
      } else {
        // Image taller: fit width, crop top/bottom
        dw = off.width
        dh = Math.round(dw / imgAspect)
        dx = 0
        dy = Math.round((off.height - dh) / 2)
      }
      octx.drawImage(img, dx, dy, dw, dh)
      const data = octx.getImageData(0, 0, off.width, off.height).data
      pixelColorsRef.current = data
      sampledDimsRef.current = { w: off.width, h: off.height }
    }

    // Fluid particles for liquid simulation
    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      life: number
      maxLife: number
      isSolid?: boolean // For earth particles - stay together until collision
      chunkId?: number // Group ID for solid chunks
      color?: { r: number, g: number, b: number }
    }

    const particles: Particle[] = []
    const maxParticles = 300

    const isMobile = window.innerWidth < 768
    const initialActive = isMobile ? 45 : 30
    // Initialize particle pool with pre-seeded active bubbles
    for (let i = 0; i < maxParticles; i++) {
      const startActive = i < initialActive
      particles.push({
        x: startActive ? Math.random() * cssWidth : 0,
        y: startActive ? Math.random() * cssHeight : 0,
        vx: startActive ? (Math.random() - 0.5) * 0.4 : 0,
        vy: startActive ? -(0.6 + Math.random() * 0.8) : 0,
        life: startActive ? 600 + Math.random() * 1000 : 0,
        maxLife: Math.random() * 100 + 50,
        color: DEMON_PALETTE[i % DEMON_PALETTE.length]
      })
    }

    let time = 0
    let particleIndex = 0
    let chunkCounter = 0

    const animate = () => {
      if (!ctx) return

      // Recalculate grid size in case canvas was resized
      cols = Math.ceil(cssWidth / pixelSize)
      rows = Math.ceil(cssHeight / pixelSize)

      // If we're in 'none' mode and grid dims changed, resample the image
      if (element === 'none' && imgRef.current) {
        if (sampledDimsRef.current.w !== cols || sampledDimsRef.current.h !== rows) {
          resampleImageToGrid()
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssWidth, cssHeight)
      ctx.imageSmoothingEnabled = true



      // Update reveal progress smoothly toward target based on hover
      if (element === 'none') {
        const target = hoveredRef.current ? 1 : 0
        // Exponential smoothing for ease
        revealTRef.current += (target - revealTRef.current) * 0.12
        // Snap if very close
        if (Math.abs(target - revealTRef.current) < 0.001) revealTRef.current = target
      } else {
        revealTRef.current = 0
      }

      // Update blend mode based on reveal progress
      if (element === 'none') {
        canvas.style.setProperty('mix-blend-mode', revealTRef.current > 0.5 ? 'normal' : 'normal')
      } else {
        canvas.style.setProperty('mix-blend-mode', 'normal')
      }

      time += 0.016 // ~60fps
      animTimeRef.current = time

      // Splash animation — U-shaped parabola then fast vertical drop
      if (splashRef.current?.active) {
        const splash = splashRef.current
        const parabolaDuration = splash.duration * 0.7  // 70% of time for the U curve
        const dropDuration = splash.duration * 0.3     // 30% for the gentle vertical drop

        if (splash.startTime < 0) {
          splash.startTime = time
          const startX = canvas.width * -0.05
          const startY = canvas.height * 0.25
          mousePosRef.current = { x: startX, y: startY }
          prevMousePosRef.current = { x: startX, y: startY }
          mouseVelocityRef.current = { x: 0, y: 0 }
          hasMouseMovedRef.current = true
        }

        const elapsed = time - splash.startTime
        const totalT = Math.min(1, elapsed / splash.duration)

        if (totalT >= 1) {
          splash.active = false
          mousePosRef.current = { x: -1000, y: -1000 }
          prevMousePosRef.current = { x: -1000, y: -1000 }
          hasMouseMovedRef.current = false
        } else if (elapsed < parabolaDuration) {
          // Phase 1: Wide U-shaped parabola with leisurely ease-in-out
          const rawT = elapsed / parabolaDuration
          // Smooth ease-in-out: slow start, smooth middle, slow end
          const t = rawT < 0.5
            ? 4 * rawT * rawT * rawT
            : 1 - Math.pow(-2 * rawT + 2, 3) / 2
          const px = canvas.width * (-0.05 + 1.1 * t)
          const py = canvas.height * (0.25 + 0.65 * (1 - 4 * Math.pow(t - 0.5, 2)))

          prevMousePosRef.current = { ...mousePosRef.current }
          mousePosRef.current = { x: px, y: py }
          mouseVelocityRef.current = {
            x: mousePosRef.current.x - prevMousePosRef.current.x,
            y: mousePosRef.current.y - prevMousePosRef.current.y
          }
        } else {
          // Phase 2: Fast vertical drop from right endpoint straight down
          const dropElapsed = elapsed - parabolaDuration
          const rawT = dropElapsed / dropDuration
          const t = 1 - Math.pow(1 - rawT, 2) // ease-out quad — fast & snappy
          const endX = canvas.width * 1.05        // right edge of parabola
          const dropStartY = canvas.height * 0.25 // top of drop (parabola end)
          const dropEndY = canvas.height * 0.45    // gentle drop
          const px = endX
          const py = dropStartY + (dropEndY - dropStartY) * t

          prevMousePosRef.current = { ...mousePosRef.current }
          mousePosRef.current = { x: px, y: py }
          mouseVelocityRef.current = {
            x: mousePosRef.current.x - prevMousePosRef.current.x,
            y: mousePosRef.current.y - prevMousePosRef.current.y
          }
        }
      }

      const mouseSpeed = Math.sqrt(mouseVelocityRef.current.x ** 2 + mouseVelocityRef.current.y ** 2)

      // Passive emitter (for 'none'): follows a smooth Lissajous curve
      passivePhaseRef.current += 0.005
      const emitterX = canvas.width * 0.5 + Math.sin(passivePhaseRef.current * 1.3) * (canvas.width * 0.28)
      const emitterY = canvas.height * 0.5 + Math.cos(passivePhaseRef.current * 0.9) * (canvas.height * 0.22)
      const emitterVX = Math.cos(passivePhaseRef.current * 1.3) * (canvas.width * 0.28) * 0.005
      const emitterVY = -Math.sin(passivePhaseRef.current * 0.9) * (canvas.height * 0.22) * 0.005

      // Spawn new particles based on mouse movement and element type
      // (blog uses ambient rain only — mouse movement never spawns)
      const spawnThreshold = element === 'fire' ? 0.5 : element === 'earth' ? 1.5 : 1
      let shouldSpawn = !preview && hasMouseMovedRef.current && mouseSpeed > spawnThreshold

      // Time-driven spawning for 'none' (passive animation)
      if (element === 'none') {
        shouldSpawn = Math.floor(time * 30) % 2 === 0 // ~15 spawns/sec
      }

      // Special cooldown logic for earth to prevent continuous rock spawning
      if (element === 'earth' && shouldSpawn) {
        const rockCooldown = 1000 // Much shorter cooldown
        const timeSinceLastRock = time * 1000 - lastRockSpawnTimeRef.current
        if (timeSinceLastRock < rockCooldown) {
          shouldSpawn = false
        } else {
          // Store the current mouse velocity for rock launching
          storedRockVelocityRef.current = {
            x: mouseVelocityRef.current.x,
            y: mouseVelocityRef.current.y
          }
        }
      }
      // Preview rain mode: spawn bubbles from the bottom, always on
      if (preview) {
        // blog hero panel is always-on ambient — no hover gating
        const rainTarget = 1
        // Smoothly interpolate rain intensity
        rainIntensityRef.current += (rainTarget - rainIntensityRef.current) * 0.04

        const intensity = rainIntensityRef.current
        // Stochastic spawn: each frame has a random chance, not fixed interval
        if (intensity > 0.01 && Math.random() < 0.15 * intensity) {
          // Random spawn point along the bottom
          const spawnX = Math.random() * canvas.width
          // Mix of sizes: mostly 3-particle blobs, some smaller 2s and occasional 1s
          const sizeRoll = Math.random()
          const dropCount = sizeRoll < 0.2 ? 1 : sizeRoll < 0.45 ? 2 : 3
          // Each bubble cluster gets its own rise speed
          const baseSpeed = 0.5 + Math.random() * 0.5
          for (let i = 0; i < dropCount; i++) {
            const particle = particles[particleIndex % maxParticles]
            particle.x = spawnX + (Math.random() - 0.5) * 3
            particle.y = canvas.height + 2 + Math.random() * 5
            particle.vx = (Math.random() - 0.5) * 0.08
            particle.vy = -(baseSpeed + (Math.random() - 0.5) * 0.05)
            particle.life = particle.maxLife = 900 + Math.random() * 600
            particle.isSolid = false
            particle.chunkId = undefined
            particle.color = DEMON_PALETTE[Math.floor(Math.random() * DEMON_PALETTE.length)]
            particleIndex++
          }
        }
      }

      if (shouldSpawn) {
        let spawnCount
        if (element === 'earth') {
          // Earth always spawns exactly one rock per mouse movement
          spawnCount = 7 // Always 3 particles for one solid rock
        } else if (element === 'none') {
          spawnCount = 3
        } else {
          const baseSpawnCount = element === 'fire' ? 5 : element === 'air' ? 4 : 3
          const spawnDivisor = element === 'fire' ? 5 : 10
          spawnCount = Math.min(baseSpawnCount, Math.floor(mouseSpeed / spawnDivisor))
        }

        // Create chunk ID for earth particles that should stay together
        const currentChunkId = element === 'earth' ? chunkCounter++ : undefined

        for (let i = 0; i < spawnCount; i++) {
          const particle = particles[particleIndex % maxParticles]

          // Element-specific spawn patterns
          let angle, radius
          const splashRadiusScale = splashRef.current?.active ? 2.5 : 1
          switch (element) {
            case 'air':
              angle = Math.random() * Math.PI * 2
              radius = (Math.random() * 25 + 10) * splashRadiusScale
              break
            case 'fire':
              angle = Math.random() * Math.PI * 2
              radius = (Math.random() * 10 + 3) * splashRadiusScale
              break
            case 'earth':
              angle = Math.random() * Math.PI * 2
              radius = Math.random() * 2 + 0.5 // Extremely tight for single rock
              break
            case 'none':
              angle = Math.random() * Math.PI * 2
              radius = (Math.random() * 18 + 6) * splashRadiusScale
              break
            default: // water
              angle = Math.random() * Math.PI * 2
              radius = (Math.random() * 15 + 5) * splashRadiusScale
          }

          if (element === 'none') {
            particle.x = emitterX + Math.cos(angle) * radius
            particle.y = emitterY + Math.sin(angle) * radius
          } else {
            particle.x = mousePosRef.current.x + Math.cos(angle) * radius
            particle.y = mousePosRef.current.y + Math.sin(angle) * radius
          }

          // Element-specific initial velocities
          if (element === 'earth') {
            // Enhanced directional control for rock throwing
            const launchPower = 1.5 // Increased power for better control
            const spreadAngle = (Math.random() - 0.5) * 0.05 // Even tighter spread for precision

            // Use stored mouse velocity for consistent launch power
            const storedVelocity = storedRockVelocityRef.current
            const mouseSpeed = Math.sqrt(storedVelocity.x ** 2 + storedVelocity.y ** 2)

            if (mouseSpeed > 0.3) {
              // Use mouse velocity direction when moving
              const mouseAngle = Math.atan2(storedVelocity.y, storedVelocity.x)
              const launchAngle = mouseAngle + spreadAngle

              // Boost power for upward throws to overcome gravity
              let adjustedLaunchPower = launchPower
              if (storedVelocity.y < 0) { // Negative Y = upward
                const upwardBoost = Math.abs(storedVelocity.y) / mouseSpeed // 0-1 based on how upward
                adjustedLaunchPower = launchPower * (1 + upwardBoost * 0.8) // Up to 80% boost for pure upward
              }

              const launchSpeed = mouseSpeed * adjustedLaunchPower

              particle.vx = Math.cos(launchAngle) * launchSpeed + (Math.random() - 0.5) * 0.02
              particle.vy = Math.sin(launchAngle) * launchSpeed + (Math.random() - 0.5) * 0.02
            } else {
              // When mouse is slow/stationary, launch toward current mouse position
              const dx = mousePosRef.current.x - particle.x
              const dy = mousePosRef.current.y - particle.y
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance > 10) { // Only launch if mouse is far enough away
                const baseSpeed = 6 // Minimum launch speed for stationary throws
                const launchAngle = Math.atan2(dy, dx) + spreadAngle

                particle.vx = Math.cos(launchAngle) * baseSpeed + (Math.random() - 0.5) * 0.02
                particle.vy = Math.sin(launchAngle) * baseSpeed + (Math.random() - 0.5) * 0.02
              } else {
                // Very close to mouse - small random launch
                particle.vx = (Math.random() - 0.5) * 2
                particle.vy = (Math.random() - 0.5) * 2
              }
            }
          } else if (element === 'water') {
            // Launch water particles like splashing/spraying water
            const splashPower = 0.25 // Less power than rocks
            const spreadAngle = (Math.random() - 0.5) * 1.2 // Wider spray pattern (~70 degrees)

            // Calculate splash direction based on mouse velocity
            const mouseAngle = Math.atan2(mouseVelocityRef.current.y, mouseVelocityRef.current.x)
            const splashAngle = mouseAngle + spreadAngle
            const splashSpeed = Math.sqrt(mouseVelocityRef.current.x ** 2 + mouseVelocityRef.current.y ** 2) * splashPower

            // Launch water droplets in a wide spray
            particle.vx = Math.cos(splashAngle) * splashSpeed + (Math.random() - 0.5) * 1.5
            particle.vy = Math.sin(splashAngle) * splashSpeed + (Math.random() - 0.5) * 1.5
          } else if (element === 'none') {
            // Gentle drift following emitter movement
            const base = 0.15
            particle.vx = emitterVX * base + (Math.random() - 0.5) * 0.3
            particle.vy = emitterVY * base + (Math.random() - 0.5) * 0.3
          } else {
            const velocityMultiplier = element === 'fire' ? 0.15 : element === 'air' ? 0.08 : 0.1
            const randomness = element === 'fire' ? 4 : element === 'air' ? 1.5 : 2

            particle.vx = mouseVelocityRef.current.x * velocityMultiplier + (Math.random() - 0.5) * randomness
            particle.vy = mouseVelocityRef.current.y * velocityMultiplier + (Math.random() - 0.5) * randomness
          }

          // Element-specific lifespans
          const baseLife = element === 'fire' ? 40 : element === 'air' ? 80 : element === 'earth' ? 300 : element === 'none' ? 140 : 100
          particle.life = particle.maxLife = baseLife + Math.random() * (baseLife / 2)

          // Set earth particle properties
          if (element === 'earth') {
            particle.isSolid = true
            particle.chunkId = currentChunkId
            // Update rock spawn time for cooldown
            lastRockSpawnTimeRef.current = time * 1000
          } else {
            particle.isSolid = false
            particle.chunkId = undefined
          }

          particleIndex++
        }
      }

      // Update particles with element-specific physics
      particles.forEach(particle => {
        if (particle.life <= 0) return

        // Element-specific gravity and forces
        switch (element) {
          case 'water':
            if (preview) {
              // Bubble physics
              // Strong constant buoyancy
              particle.vy -= 0.045

              // Per-particle wobble phase derived from spawn position
              const phase = particle.x * 0.7 + particle.maxLife * 0.1
              // Slow sinusoidal horizontal drift — like bubbles lazily swaying
              const wobbleX = Math.sin(time * 0.8 + phase) * 0.01
              // Very subtle vertical oscillation layered on top of rise
              const wobbleY = Math.cos(time * 1.2 + phase * 1.3) * 0.004
              particle.vx += wobbleX
              particle.vy += wobbleY

              // Kill bubble when it reaches the top of the canvas
              if (particle.y < -pixelSize) {
                particle.life = 0
              }
            } else {
              // Normal water: gravity + wave
              particle.vy += 0.06
              const waveEffect = Math.sin(time * 0.02 + particle.x * 0.01) * 0.015
              particle.vy += waveEffect
              particle.vx += Math.cos(time * 0.015 + particle.y * 0.008) * 0.01
            }
            break
          case 'air':
            // Air pushes particles apart with wind-like movement
            particle.vy -= 0.02
            const windForce = Math.sin(time * 0.02 + particle.x * 0.005) * 0.04
            particle.vx += windForce
            particle.vy += Math.cos(time * 0.015 + particle.y * 0.003) * 0.02
            break
          case 'fire':
            // Flame-like behavior: strong upward with narrowing effect
            const flameHeight = canvas.height - particle.y
            const flameNarrowingFactor = Math.max(0.3, 1 - (flameHeight / canvas.height))

            // Strong upward movement that increases with height
            particle.vy -= 0.12 + (flameHeight / canvas.height) * 0.08

            // Horizontal flickering that narrows as it goes up
            const flicker = (Math.random() - 0.5) * 0.4 * flameNarrowingFactor
            particle.vx += flicker

            // Additional random movement for flame dancing
            particle.vx += Math.sin(time * 0.1 + particle.x * 0.02) * 0.05
            particle.vy += (Math.random() - 0.7) * 0.15 // Slight downward bias in randomness
            break
          case 'earth':
            // Reduced gravity for better upward throwing
            particle.vy += 0.15 // Lighter gravity for better flight physics

            // Heavy objects are affected by air resistance and friction
            const speed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2)
            if (speed > 0.1) {
              const airResistance = 0.003 // Even less air resistance for better upward throws
              particle.vx *= (1 - airResistance)
              particle.vy *= (1 - airResistance)
            }

            // Additional friction for slow-moving particles near edges
            const edgeDistance = Math.min(
              particle.x,
              canvas.width - particle.x,
              particle.y,
              canvas.height - particle.y
            )
            if (edgeDistance < 5 && speed < 2.0) {
              const edgeFriction = 0.15 // Strong friction near edges
              particle.vx *= (1 - edgeFriction)
              particle.vy *= (1 - edgeFriction)
            }

            // Less smooth movement - add some "chunky" discrete movement
            if (Math.random() < 0.1) {
              particle.vx += (Math.random() - 0.5) * 0.3
              particle.vy += (Math.random() - 0.5) * 0.2
            }
            break
          case 'none':
            // Gentle floating & swirling motion
            particle.vx += Math.cos(time * 0.02 + particle.y * 0.005) * 0.01
            particle.vy += Math.sin(time * 0.018 + particle.x * 0.006) * 0.01
            // Very light gravity-like sink for depth
            particle.vy += Math.sin(time * 0.01) * 0.003
            break
        }

        // Attraction to mouse (varies by element)
        const dx = mousePosRef.current.x - particle.x
        const dy = mousePosRef.current.y - particle.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        const attractionRange = element === 'air' ? 150 : element === 'fire' ? 80 : element === 'earth' ? 60 : element === 'none' ? 140 : 140
        const attractionForce = element === 'fire' ? 0.04 : element === 'air' ? 0.015 : element === 'earth' ? 0.08 : element === 'none' ? 0.01 : 0.2

        if (element !== 'none' && distance > 0 && distance < attractionRange) {
          if (element === 'earth') {
            // Earth particles don't get attracted to mouse - they're independent projectiles
            // Only very weak repulsion if mouse gets too close (like bouncing off)
            if (distance < 20) {
              const repelForce = 0.05
              particle.vx -= (dx / distance) * repelForce
              particle.vy -= (dy / distance) * repelForce
            }
          } else if (element === 'water') {
            // Water has weaker attraction - more like splashing/spraying
            const waterSpeed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2)
            if (waterSpeed < 2) { // Only attract slow-moving water droplets
              const force = attractionForce * 0.3 / (1 + distance * 0.05) // Much weaker
              particle.vx += (dx / distance) * force
              particle.vy += (dy / distance) * force
            }
          } else {
            const force = attractionForce / (1 + distance * 0.05)
            particle.vx += (dx / distance) * force
            particle.vy += (dy / distance) * force
          }
        }
        // For 'none', attract very gently to the moving emitter for cohesive blobs
        if (element === 'none') {
          const ex = emitterX - particle.x
          const ey = emitterY - particle.y
          const ed = Math.sqrt(ex * ex + ey * ey)
          if (ed > 0 && ed < attractionRange) {
            const force = 0.008 / (1 + ed * 0.03)
            particle.vx += (ex / ed) * force
            particle.vy += (ey / ed) * force
          }
        }

        // Element-specific cohesion/dispersion behavior
        if (element === 'air') {
          // Air disperses particles (anti-cohesion)
          let separationX = 0, separationY = 0, neighborCount = 0
          const dispersalRange = 40

          particles.forEach(other => {
            if (other === particle || other.life <= 0) return

            const odx = other.x - particle.x
            const ody = other.y - particle.y
            const odist = Math.sqrt(odx * odx + ody * ody)

            if (odist > 0 && odist < dispersalRange) {
              const force = (dispersalRange - odist) / dispersalRange
              separationX -= (odx / odist) * force * 0.05
              separationY -= (ody / odist) * force * 0.05
              neighborCount++
            }
          })

          if (neighborCount > 0) {
            particle.vx += separationX
            particle.vy += separationY
          }
        } else if (element === 'fire') {
          // Fire has minimal cohesion but slight flame channeling
          let neighborX = 0, neighborCount = 0
          const flameRange = 15

          particles.forEach(other => {
            if (other === particle || other.life <= 0) return

            const odx = other.x - particle.x
            const ody = other.y - particle.y
            const odist = Math.sqrt(odx * odx + ody * ody)

            if (odist < flameRange && odist > 0 && other.y < particle.y) { // Only attract to particles below
              neighborX += other.x
              neighborCount++
            }
          })

          if (neighborCount > 0) {
            const avgX = neighborX / neighborCount
            const channelForce = 0.005 // Very weak flame channeling
            particle.vx += (avgX - particle.x) * channelForce
          }
        } else if (element === 'water' || element === 'none') {
          // Water and none have surface tension (cohesion)
          let neighborX = 0, neighborY = 0, neighborCount = 0
          const cohesionRange = preview ? 28 : 50

          particles.forEach(other => {
            if (other === particle || other.life <= 0) return

            const odx = other.x - particle.x
            const ody = other.y - particle.y
            const odist = Math.sqrt(odx * odx + ody * ody)

            if (odist > 0 && odist < cohesionRange) {
              neighborX += other.x
              neighborY += other.y
              neighborCount++
            }
          })

          if (neighborCount > 0) {
            const avgX = neighborX / neighborCount
            const avgY = neighborY / neighborCount
            const surfaceTension = preview ? 0.002 : 0.012
            particle.vx += (avgX - particle.x) * surfaceTension
            particle.vy += (avgY - particle.y) * surfaceTension

            // In preview: merged bubbles align velocities, combine colors via HSL, and get an upward boost
            if (preview && neighborCount >= 1) {
              const pColor = particle.color || DEMON_PALETTE[0]

              particles.forEach(other => {
                if (other === particle || other.life <= 0) return
                const odx = other.x - particle.x
                const ody = other.y - particle.y
                const odist = Math.sqrt(odx * odx + ody * ody)
                if (odist < cohesionRange && odist > 0 && other.color) {
                  particle.color = combineDemonColors(pColor, other.color, 1, 1)
                }
              })

              if (neighborCount >= 2) {
                // Align to group velocity
                const avgVY = 0; // Simplified for this snippet
                particle.vy += (avgVY - particle.vy) * 0.05
                // Extra upward boost proportional to cluster size
                particle.vy -= 0.003 * Math.min(neighborCount, 5)
              }
            }
          }
        } else {
          // Earth particles - behavior depends on solid state
          if (particle.isSolid && particle.chunkId !== undefined) {
            // Solid chunks - very strong cohesion to stay together
            let neighborX = 0, neighborY = 0, neighborCount = 0
            const cohesionRange = 20

            particles.forEach(other => {
              if (other === particle || other.life <= 0 || other.chunkId !== particle.chunkId) return

              const odx = other.x - particle.x
              const ody = other.y - particle.y
              const odist = Math.sqrt(odx * odx + ody * ody)

              if (odist < cohesionRange && odist > 0) {
                neighborX += other.x
                neighborY += other.y
                neighborCount++
              }
            })

            if (neighborCount > 0) {
              const avgX = neighborX / neighborCount
              const avgY = neighborY / neighborCount
              const solidCohesion = 0.15 // Extremely strong cohesion for single rock
              particle.vx += (avgX - particle.x) * solidCohesion
              particle.vy += (avgY - particle.y) * solidCohesion
            }
          } else {
            // Broken earth particles - completely independent, no interaction
            // Rock fragments don't attract or repel each other - they're just solid chunks
          }
        }

        // Element-specific velocity damping
        const baseDamping = element === 'fire' ? 0.88 : element === 'air' ? 0.97 : element === 'earth' ? 0.995 : element === 'none' ? 0.975 : 0.95
        const damping = (preview && element === 'water') ? 0.993 : baseDamping
        particle.vx *= damping
        particle.vy *= damping

        // Update position
        particle.x += particle.vx
        particle.y += particle.vy

        // Age the particle
        particle.life -= 1

        // Element-specific edge bouncing
        if (element === 'earth') {
          // Check for wall collisions and break solid chunks
          let hitWall = false
          if (particle.x < 0 || particle.x > canvas.width) {
            hitWall = true
            // Solid rock bounce - more realistic for individual fragments
            particle.vx *= particle.isSolid ? -0.3 : -0.4 // Less bounce, more stopping
            particle.x = Math.max(0, Math.min(canvas.width, particle.x))

            // Add friction when hitting walls - particles lose energy and stick
            if (Math.abs(particle.vx) < 1.0) {
              particle.vx *= 0.3 // Heavy friction for slow particles
            }
          }
          if (particle.y < 0 || particle.y > canvas.height) {
            hitWall = true
            // Ground/ceiling bounce - fragments should settle more
            particle.vy *= particle.isSolid ? -0.1 : -0.2 // Even less bounce
            particle.y = Math.max(0, Math.min(canvas.height, particle.y))

            // Ground friction - particles settle and stop sliding
            if (particle.y >= canvas.height - 1 && Math.abs(particle.vy) < 1.5) {
              particle.vy *= 0.1 // Almost stop vertical movement on ground
              particle.vx *= 0.7 // Horizontal friction on ground
            }
          }

          // Break solid chunk on wall collision
          if (hitWall && particle.isSolid && particle.chunkId !== undefined) {
            // Calculate impact direction and rock momentum for realistic shatter
            const originalParticles = particles.filter(p => p.chunkId === particle.chunkId && p.life > 0)
            const chunkCenterX = originalParticles.reduce((sum, p) => sum + p.x, 0) / originalParticles.length
            const chunkCenterY = originalParticles.reduce((sum, p) => sum + p.y, 0) / originalParticles.length

            // Calculate average momentum of the rock before impact
            const avgVelocityX = originalParticles.reduce((sum, p) => sum + p.vx, 0) / originalParticles.length
            const avgVelocityY = originalParticles.reduce((sum, p) => sum + p.vy, 0) / originalParticles.length
            const impactSpeed = Math.sqrt(avgVelocityX ** 2 + avgVelocityY ** 2)

            // Impact direction is calculated from individual particle velocities below

            // Break existing particles with momentum-based shatter
            originalParticles.forEach((p, index) => {
              p.isSolid = false

              // Use the actual particle's velocity at impact, not averaged
              const particleSpeed = Math.sqrt(p.vx ** 2 + p.vy ** 2)
              const particleAngle = Math.atan2(p.vy, p.vx)

              // Create fragments that mostly continue in original direction with slight spread
              const fragmentAngle = particleAngle + (Math.random() - 0.5) * Math.PI * 0.4 // Reduced to 72° spread
              const momentumInheritance = 0.7 + Math.random() * 0.4 // 70-110% of original speed (less amplification)
              const fragmentSpeed = particleSpeed * momentumInheritance

              // Larger fragments (first particles) get slightly more momentum
              const sizeFactor = index === 0 ? 1.2 : 1.0

              p.vx = Math.cos(fragmentAngle) * fragmentSpeed * sizeFactor
              p.vy = Math.sin(fragmentAngle) * fragmentSpeed * sizeFactor

              // Much gentler random scatter - more like natural breaking
              const scatterStrength = Math.min(particleSpeed * 0.15, 2.0) // Reduced scatter
              p.vx += (Math.random() - 0.5) * scatterStrength
              p.vy += (Math.random() - 0.5) * scatterStrength

              // Keep original rock particles at normal size - only splinters are tiny
              // p.life and p.maxLife stay unchanged for main fragments
            })

            // Create many more tiny sharp fragments
            const splinterCount = 1 // Many more small fragments
            for (let i = 0; i < splinterCount; i++) {
              const splinter = particles[particleIndex % maxParticles]

              // Spawn tiny fragments right at impact point
              const spawnAngle = Math.random() * Math.PI * 2
              const spawnRadius = Math.random() * 2 // Very tight spawn
              splinter.x = chunkCenterX + Math.cos(spawnAngle) * spawnRadius
              splinter.y = chunkCenterY + Math.sin(spawnAngle) * spawnRadius

              // Small dust fragment with moderate scatter
              const shardAngle = Math.atan2(avgVelocityY, avgVelocityX) + (Math.random() - 0.5) * Math.PI * 0.6 // Reduced scatter
              const shardSpeed = impactSpeed * (0.4 + Math.random() * 0.4) // 40-80% of actual impact speed

              splinter.vx = Math.cos(shardAngle) * shardSpeed
              splinter.vy = Math.sin(shardAngle) * shardSpeed

              // Gentler dust scatter - just a bit of debris
              const dustScatter = Math.min(impactSpeed * 0.2, 2.5)
              splinter.vx += (Math.random() - 0.5) * dustScatter
              splinter.vy += (Math.random() - 0.5) * dustScatter

              // Very small dust fragments
              splinter.life = splinter.maxLife = 30 + Math.random() * 20 // Much smaller fragments
              splinter.isSolid = false
              splinter.chunkId = undefined

              particleIndex++
            }
          }
        } else if (element === 'water') {
          if (preview) {
            // Bubbles: die at edges
            if (particle.x < -5 || particle.x > canvas.width + 5) {
              particle.life = 0
            }
          } else {
            // Water droplets have soft bounces
            if (particle.x < 0 || particle.x > canvas.width) {
              particle.vx *= -0.2
              particle.x = Math.max(0, Math.min(canvas.width, particle.x))
            }
            if (particle.y < 0 || particle.y > canvas.height) {
              particle.vy *= -0.1
              particle.y = Math.max(0, Math.min(canvas.height, particle.y))
            }
          }
        } else {
          // Other elements bounce gently
          if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -0.3
          if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -0.3
          particle.x = Math.max(0, Math.min(canvas.width, particle.x))
          particle.y = Math.max(0, Math.min(canvas.height, particle.y))
        }
      })

      // Create density field for smooth blob rendering
      const densityField: number[][] = []
      for (let y = 0; y < rows; y++) {
        densityField[y] = []
        for (let x = 0; x < cols; x++) {
          densityField[y][x] = 0
        }
      }

      // Calculate density field from particles
      particles.forEach(particle => {
        if (particle.life <= 0) return

        const centerX = Math.floor(particle.x / pixelSize)
        const centerY = Math.floor(particle.y / pixelSize)
        const lifeRatio = particle.life / particle.maxLife

        // Add influence to surrounding cells
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = centerX + dx
            const y = centerY + dy

            if (x >= 0 && x < cols && y >= 0 && y < rows) {
              const distance = Math.sqrt(dx * dx + dy * dy)
              const influence = Math.max(0, 1 - distance / 3) * lifeRatio
              densityField[y][x] += influence
            }
          }
        }
      })

      // Draw hover mosaic overlay for 'none' element, crossfading by revealT
      if (element === 'none' && revealTRef.current > 0.01) {
        if (!pixelColorsRef.current || sampledDimsRef.current.w !== cols || sampledDimsRef.current.h !== rows) {
          resampleImageToGrid()
        }
        if (pixelColorsRef.current) {
          ctx.save()
          // Use normal blend while revealing for clearer colors
          ctx.globalAlpha = Math.min(1, revealTRef.current)
          // Do not scale individual pixels; use the exact grid pixel size
          const mosaicPixel = pixelSize
          // Reveal grows radially from a fixed center during hover to avoid shifting
          const ex = (hoverCenterRef.current?.x ?? Math.floor(emitterX / pixelSize))
          const ey = (hoverCenterRef.current?.y ?? Math.floor(emitterY / pixelSize))
          const maxR = Math.hypot(cols, rows)
          const revealR = Math.max(0, Math.min(maxR, maxR * revealTRef.current))
          // Crisp blocks
          const prevSmooth = ctx.imageSmoothingEnabled
          ctx.imageSmoothingEnabled = false
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const dx = x - ex
              const dy = y - ey
              const dist = Math.hypot(dx, dy)
              if (dist > revealR) continue
              const idx = (y * cols + x) * 4
              const r = pixelColorsRef.current[idx]
              const g = pixelColorsRef.current[idx + 1]
              const b = pixelColorsRef.current[idx + 2]
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
              // Draw exact grid-aligned block (no scaling)
              // Snap to integer pixel positions to avoid subpixel jitter
              const px = Math.round(x * pixelSize)
              const py = Math.round(y * pixelSize)
              ctx.fillRect(px, py, mosaicPixel, mosaicPixel)
            }
          }
          ctx.imageSmoothingEnabled = prevSmooth
          ctx.restore()
        }
      }

      // Render smooth fluid blobs (all elements)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const density = densityField[y][x]
          if (density > 0.2) {
            const pixelX = x * pixelSize
            const pixelY = y * pixelSize
            let alpha: number, r: number, g: number, b: number

            switch (element) {
              case 'water':
                const particleColor = DEMON_PALETTE[(x + y * 7) % DEMON_PALETTE.length]
                r = particleColor.r
                g = particleColor.g
                b = particleColor.b
                alpha = 1.0
                break
              case 'air':
                if (density < 0.4) {
                  r = 220 + density * 20
                  g = 230 + density * 15
                  b = 240 + density * 10
                  alpha = 0.1 + density * 0.2
                } else if (density < 0.7) {
                  r = 180 + density * 30
                  g = 200 + density * 25
                  b = 230 + density * 20
                  alpha = 0.3 + density * 0.3
                } else {
                  r = 140 + density * 40
                  g = 170 + density * 35
                  b = 220 + density * 30
                  alpha = 0.6 + density * 0.3
                }
                break
              case 'fire':
                if (density < 0.3) {
                  r = 255
                  g = Math.floor(100 + density * 200)
                  b = Math.floor(density * 100)
                  alpha = 0.3 + density * 0.7
                } else if (density < 0.7) {
                  r = 255
                  g = Math.floor(160 + density * 120)
                  b = Math.floor(density * 150)
                  alpha = 0.7 + density * 0.3
                } else {
                  r = 255
                  g = 240 + Math.floor(density * 15)
                  b = Math.floor(180 + density * 75)
                  alpha = 1.0
                }
                break
              case 'earth':
                if (density < 0.4) {
                  r = 90 + density * 40
                  g = 70 + density * 30
                  b = 40 + density * 20
                  alpha = 0.3 + density * 0.4
                } else if (density < 0.7) {
                  r = 70 + density * 35
                  g = 55 + density * 40
                  b = 25 + density * 25
                  alpha = 0.5 + density * 0.3
                } else {
                  r = 50 + density * 30
                  g = 35 + density * 35
                  b = 15 + density * 20
                  alpha = 0.7 + density * 0.25
                }
                break
              case 'none':
                if (pixelColorsRef.current && sampledDimsRef.current.w === cols && sampledDimsRef.current.h === rows) {
                  const idx = (y * cols + x) * 4
                  r = pixelColorsRef.current[idx]
                  g = pixelColorsRef.current[idx + 1]
                  b = pixelColorsRef.current[idx + 2]
                  alpha = 0.15 + Math.min(0.65, density * 0.6)
                } else {
                  if (density < 0.4) {
                    r = 160 + density * 30
                    g = 170 + density * 40
                    b = 220 + density * 35
                    alpha = 0.15 + density * 0.25
                  } else if (density < 0.7) {
                    r = 120 + density * 40
                    g = 130 + density * 35
                    b = 210 + density * 30
                    alpha = 0.3 + density * 0.25
                  } else {
                    r = 90 + density * 45
                    g = 100 + density * 40
                    b = 200 + density * 35
                    alpha = 0.45 + density * 0.25
                  }
                }
                break
            }

            // Subtle movement-based color variation
            const colorNoise = Math.sin(time * 0.5 + x * 0.2 + y * 0.2) * 10
            r = Math.max(0, Math.min(255, r + colorNoise))
            g = Math.max(0, Math.min(255, g + colorNoise))
            b = Math.max(0, Math.min(255, b + colorNoise))

            if (element === 'water') {
              const normD = Math.max(0, Math.min(1, (density - 0.10) / 0.38))
              const dotSize = 2.2
              const dotsX = Math.ceil(pixelSize / dotSize)
              const dotsY = Math.ceil(pixelSize / dotSize)
              ctx.save()

              // Concentric Japanese Demonic Shader (Hard Flame Edges & Sharp Onibi Dither):
              let cellR: number, cellG: number, cellB: number

              if (normD >= 0.60) {
                // Luminous white-hot electric cyan core
                const t = (normD - 0.60) / 0.40
                cellR = Math.round(180 * t)
                cellG = Math.round(200 + t * 55)
                cellB = 255
              } else if (normD >= 0.25) {
                // Vivid electric azure & cobalt blue flame body
                const t = (normD - 0.25) / 0.35
                cellR = Math.round(0 + t * 40)
                cellG = Math.round(100 + t * 100)
                cellB = Math.round(220 + t * 35)
              } else {
                // Hard-edged phantom violet-blue Onibi flame boundary
                const t = normD / 0.25
                cellR = Math.round(100 - t * 100)
                cellG = Math.round(0 + t * 100)
                cellB = Math.round(200 + t * 20)
              }

              ctx.fillStyle = `rgb(${cellR}, ${cellG}, ${cellB})`

              const isMobile = checkIsMobile()
              if (isMobile && normD >= 0.45) {
                ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize)
              } else {
                for (let sy = 0; sy < dotsY; sy++) {
                  for (let sx = 0; sx < dotsX; sx++) {
                    const px = pixelX + sx * dotSize
                    const py = pixelY + sy * dotSize
                    const ditherX = Math.floor(px / dotSize)
                    const ditherY = Math.floor(py / dotSize)
                    const threshold = BAYER_8X8[ditherY % 8][ditherX % 8]

                    if (normD > threshold * 0.70) {
                      ctx.fillRect(px, py, dotSize - 0.1, dotSize - 0.1)
                    }
                  }
                }
              }
              ctx.restore()
            } else {
              ctx.save()
              const revealFade = element === 'none' ? (1 - Math.min(1, Math.max(0, revealTRef.current))) : 1
              ctx.globalAlpha = Math.min(alpha, 0.8) * revealFade
              ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`

              const sizeVariation = 1 + Math.sin(time * 0.3 + x * 0.1 + y * 0.1) * 0.15
              const size = pixelSize * 8 * sizeVariation * Math.min(density * 2, 1)
              ctx.beginPath()
              ctx.arc(pixelX + pixelSize / 2, pixelY + pixelSize / 2, size / 2, 0, Math.PI * 2)
              ctx.fill()
              ctx.restore()
            }

            // Highlights
            if (density > 0.6 && Math.random() < 0.03) {
              ctx.save()
              ctx.globalAlpha = 0.4 * (element === 'none' ? (1 - Math.min(1, Math.max(0, revealTRef.current))) : 1)
              ctx.fillStyle = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 20)})`
              const highlightSize = size * 0.4
              ctx.beginPath()
              ctx.arc(pixelX + pixelSize / 2, pixelY + pixelSize / 2, highlightSize / 2, 0, Math.PI * 2)
              ctx.fill()
              ctx.restore()
            }
          }
        }
      }

      // Decay mouse velocity
      mouseVelocityRef.current.x *= 0.85
      mouseVelocityRef.current.y *= 0.85

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      clearTimeout(initTimer)
      if (resizeObserver) resizeObserver.disconnect()
      window.removeEventListener('resize', resizeCanvas)
      if (parentElement) {
        parentElement.removeEventListener('mousemove', handleMouseMove)
        parentElement.removeEventListener('touchstart', handleTouchStart)
        parentElement.removeEventListener('touchmove', handleTouchMove)
        parentElement.removeEventListener('mouseenter', handleMouseEnter)
        parentElement.removeEventListener('mouseleave', handleMouseLeave)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [element, preview])

  return (
    <canvas
      ref={canvasRef}
      className={`ferrofluid-canvas ${className ?? ''}`}
      style={{
        mixBlendMode: 'normal',
        borderRadius: 'inherit',
        pointerEvents: 'none',
      }}
    />
  )
} 