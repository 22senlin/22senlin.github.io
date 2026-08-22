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

function combineDemonColors(c1, c2, w1 = 1, w2 = 1) {
  const totalW = w1 + w2;
  const mixR = Math.round((c1.r * w1 + c2.r * w2) / totalW);
  const mixG = Math.round((c1.g * w1 + c2.g * w2) / totalW);
  const mixB = Math.round((c1.b * w1 + c2.b * w2) / totalW);
  return { r: mixR, g: mixG, b: mixB };
}

export function FerrofluidEffect({ element = 'water', className, preview = false }) {
  const canvasRef = useRef(null)
  const mousePosRef = useRef({ x: -1000, y: -1000 })
  const prevMousePosRef = useRef({ x: -1000, y: -1000 })
  const mouseVelocityRef = useRef({ x: 0, y: 0 })
  const hasMouseMovedRef = useRef(false)
  const animationRef = useRef(null)
  const animTimeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Dynamic ferrofluid color
    const ferrofluidColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ffffff';

    const checkIsMobile = () => {
      if (typeof window === 'undefined') return false
      return window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Twitter|FBAN|FBAV/i.test(navigator.userAgent || '')
    }

    let cssWidth = 0
    let cssHeight = 0
    let dpr = 1

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
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

    const parentElement = canvas.parentElement
    let resizeObserver = null
    if (parentElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas()
      })
      resizeObserver.observe(parentElement)
    }

    const initTimer = setTimeout(resizeCanvas, 350)

    const handlePointerMove = (clientX, clientY) => {
      if (!canvas) return
      const container = canvas.parentElement ?? canvas
      const rect = container.getBoundingClientRect()
      const newMousePos = {
        x: clientX - rect.left,
        y: clientY - rect.top
      }

      if (!hasMouseMovedRef.current) {
        hasMouseMovedRef.current = true
        mousePosRef.current = newMousePos
        prevMousePosRef.current = newMousePos
        mouseVelocityRef.current = { x: 0, y: 0 }
        return
      }

      mouseVelocityRef.current = {
        x: newMousePos.x - prevMousePosRef.current.x,
        y: newMousePos.y - prevMousePosRef.current.y
      }

      prevMousePosRef.current = { ...mousePosRef.current }
      mousePosRef.current = newMousePos
    }

    const handleMouseMove = (e) => handlePointerMove(e.clientX, e.clientY)
    const handleTouchMove = (e) => {
      if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
    }

    if (parentElement) {
      parentElement.addEventListener('mousemove', handleMouseMove)
      parentElement.addEventListener('touchmove', handleTouchMove, { passive: true })
    }

    const basePixelSize = 6
    const previewPixelSize = 8
    let cols = Math.ceil((cssWidth || 360) / (preview ? previewPixelSize : basePixelSize))
    let rows = Math.ceil((cssHeight || 240) / (preview ? previewPixelSize : basePixelSize))

    const isMobile = checkIsMobile()
    const particles = []
    const maxParticles = 200

    // Start with pre-populated active bubbles across screen height on page load
    const initialActive = isMobile ? 45 : 30
    for (let i = 0; i < maxParticles; i++) {
      const startActive = i < initialActive
      const initR = isMobile ? (12 + Math.random() * 14) : (20 + Math.random() * 16)
      particles.push({
        x: startActive ? Math.random() * cssWidth : -100,
        y: startActive ? Math.random() * cssHeight : -100,
        vx: startActive ? (Math.random() - 0.5) * 0.4 : 0,
        vy: startActive ? -(0.6 + Math.random() * 0.8) : 0,
        life: startActive ? 600 + Math.random() * 1000 : 0,
        maxLife: 1600,
        radius: initR,
        targetRadius: initR,
        stretch: 1.0,
        angle: 0,
        color: DEMON_PALETTE[i % DEMON_PALETTE.length]
      })
    }

    let time = 0

    const animate = () => {
      if (!ctx) return
      const isMobile = window.innerWidth < 768
      const pixelSize = preview ? previewPixelSize : (isMobile ? previewPixelSize : basePixelSize)
      cols = Math.ceil(cssWidth / pixelSize)
      rows = Math.ceil(cssHeight / pixelSize)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssWidth, cssHeight)
      time += 0.008
      animTimeRef.current = time

      const activeCount = particles.filter(p => p.life > 0).length
      const containerArea = (cssWidth || 750) * (cssHeight || 900)
      const baseArea = 960 * 1000
      const areaFactor = Math.min(1.25, Math.max(0.7, containerArea / baseArea))
      const targetVolume = isMobile ? 65 : Math.round(85 * areaFactor)

      // Continuously spawn individual bubbles from below the bottom edge at a steady cadence
      if (activeCount < targetVolume && Math.random() < (isMobile ? 0.35 : 0.22)) {
        const deadParticle = particles.find(p => p.life <= 0)
        if (deadParticle) {
          deadParticle.x = Math.random() * cssWidth
          deadParticle.y = cssHeight + 20 + Math.random() * 35
          deadParticle.vx = (Math.random() - 0.5) * 0.4
          deadParticle.vy = -(isMobile ? (0.60 + Math.random() * 0.45) : (1.25 + Math.random() * 0.85))
          deadParticle.life = deadParticle.maxLife = 1600
          const minR = isMobile ? 12 : Math.max(24, 4.5 * pixelSize)
          const initR = minR + Math.random() * (isMobile ? 10 : 16)
          deadParticle.radius = initR
          deadParticle.targetRadius = initR
          deadParticle.stretch = 1.0
          deadParticle.angle = 0
          deadParticle.color = DEMON_PALETTE[Math.floor(Math.random() * DEMON_PALETTE.length)]
        }
      }

      particles.forEach(p => {
        if (p.life <= 0) return

        // Smooth gradual radius growth towards target size
        if (p.targetRadius && p.radius < p.targetRadius) {
          p.radius += (p.targetRadius - p.radius) * 0.08
        }

        // Fire vs Water buoyancy & flame dynamics
        const isFire = element === 'fire'
        const buoyancyFactor = isFire ? 1.8 : 1.0
        const buoyancy = (isMobile ? (0.008 + (p.radius / 16) * 0.025) : (0.015 + (p.radius / 14) * 0.065)) * buoyancyFactor
        p.vy -= buoyancy
        const phase = p.x * 0.1 + p.maxLife * 0.5

        if (isFire) {
          // Flame flickering, horizontal dancing & flame stretch
          p.vx += (Math.random() - 0.5) * 0.14 + Math.sin(time * 2.5 + phase) * 0.06
          p.stretch += (1.20 + Math.sin(time * 3 + phase) * 0.15 - p.stretch) * 0.1
        } else {
          p.vx += Math.sin(time * 0.6 + phase) * 0.03
        }

        // Mouse Interaction (smooth, natural interaction)
        const dx = mousePosRef.current.x - p.x
        const dy = mousePosRef.current.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 130) {
          const force = (1 - dist / 150) * 0.06
          p.vx += (dx / dist) * force + mouseVelocityRef.current.x * 0.012
          p.vy += (dy / dist) * force + mouseVelocityRef.current.y * 0.012
        }

        // Prevent any bubbles from getting stuck at the bottom floor
        if (p.y > cssHeight - 35) {
          p.vy = Math.min(p.vy, -1.5)
        }

        // Occasional clean trail bubbles appearing below larger bubbles
        if (p.y < cssHeight - 40 && p.vy < -0.3 && p.radius >= 22 && Math.random() < 0.04) {
          const trail = particles.find(other => other.life <= 0)
          if (trail) {
            trail.x = p.x + (Math.random() - 0.5) * (p.radius * 0.4)
            trail.y = p.y + p.radius * 0.95 + Math.random() * 6
            trail.vx = p.vx * 0.4 + (Math.random() - 0.5) * 0.2
            trail.vy = -Math.max(0.75, Math.abs(p.vy) * 0.50)
            const trailR = Math.max(16, p.radius * (0.40 + Math.random() * 0.15))
            trail.radius = trailR
            trail.targetRadius = trailR
            trail.stretch = 1.05
            trail.angle = 0
            trail.life = trail.maxLife = 650 + Math.random() * 450
          }
        }

        // Rare break apart into smaller bubbles while rising
        if (p.radius >= 28 && p.vy < -0.3 && Math.random() < 0.006) {
          const child = particles.find(other => other.life <= 0)
          if (child) {
            const splitR = Math.max(16, p.radius * 0.60)
            p.radius = splitR
            p.targetRadius = splitR
            p.vx -= (0.4 + Math.random() * 0.4)

            child.x = p.x + (Math.random() - 0.5) * 8
            child.y = p.y + p.radius * 0.8
            child.vx = p.vx + (0.4 + Math.random() * 0.4)
            child.vy = p.vy * 0.5 - 0.3
            child.radius = splitR
            child.targetRadius = splitR
            child.life = child.maxLife = Math.min(p.life, 700 + Math.random() * 300)
          }
        }

        // Mitosis: split into two medium bubbles if a bubble grows too large (>= 55px)
        if (p.radius >= 55) {
          const splitChild = particles.find(other => other.life <= 0)
          if (splitChild) {
            const splitR = Math.max(24, p.radius * 0.62)
            p.radius = splitR
            p.targetRadius = splitR
            p.vx = -1.2
            p.stretch = 1.3
            p.angle = Math.PI / 4

            splitChild.x = p.x + 12
            splitChild.y = p.y
            splitChild.vx = 1.2
            splitChild.vy = p.vy
            splitChild.radius = splitR
            splitChild.targetRadius = splitR
            splitChild.stretch = 1.3
            splitChild.angle = -Math.PI / 4
            splitChild.life = splitChild.maxLife = Math.min(p.life, 900)
          }
        }

        // Bubble interactions: attract & fusion when centers penetrate
        particles.forEach(other => {
          if (other === p || other.life <= 0) return
          const odx = other.x - p.x
          const ody = other.y - p.y
          const odist = Math.sqrt(odx * odx + ody * ody)
          // Bounded interaction distance so large bubbles don't act like global black holes
          const maxInteractDist = Math.min(100, (p.radius + other.radius) * 1.4)

          if (odist > 0 && odist < maxInteractDist) {
            const nx = odx / odist
            const ny = ody / odist

            const normDist = odist / maxInteractDist
            const pullForce = (1 - normDist) * 0.04

            // Balanced 50/50 clockwise and counter-clockwise orbital spin
            const spinDir = ((Math.floor(p.maxLife + other.maxLife)) % 2 === 0) ? 1 : -1
            const spinMagnitude = (1 - normDist) * 0.035

            // Tangential vector (Clockwise for +1, Counter-Clockwise for -1)
            const tx = ny * spinDir
            const ty = -nx * spinDir

            // Attract radially + spin with balanced clockwise/counterclockwise forces
            p.vx += nx * pullForce + tx * spinMagnitude
            p.vy += ny * pullForce + ty * spinMagnitude

            // Gentle fluid elongation
            const angle = Math.atan2(ody, odx)
            const targetStretch = 1.0 + 0.12 * (1 - normDist)
            p.angle = angle
            p.stretch += (targetStretch - p.stretch) * 0.15

            // Fusion: merge when centers penetrate deeply
            const touchDist = (p.radius + other.radius) * 0.22
            if (odist < touchDist && p.radius >= (other.radius * 0.80)) {
              const r1 = p.radius
              const r2 = other.radius
              const tr1 = p.targetRadius || r1
              const tr2 = other.targetRadius || r2

              // Combine colors of colliding bubbles
              const c1 = p.color || DEMON_PALETTE[0]
              const c2 = other.color || DEMON_PALETTE[0]
              p.color = combineDemonColors(c1, c2, r1 * r1, r2 * r2)

              // Calculate combined sum capped at a balanced max radius (54px max)
              const combinedCurrentR = Math.min(54, Math.hypot(r1, r2))
              const combinedTargetR = Math.min(54, Math.hypot(tr1, tr2) * 1.08 + 2.0)

              p.radius = Math.max(p.radius, combinedCurrentR)
              p.targetRadius = Math.max(p.radius, combinedTargetR)

              p.stretch = 1.25
              p.angle = angle

              // Velocity blending
              p.vy = Math.min(p.vy, -1.0)
              p.vx = (p.vx + other.vx) * 0.5

              // Add finite life boost instead of resetting life to 1200 indefinitely
              p.life = Math.min(1000, p.life + 150)
              other.life = 0
            }
          }
        })

        // Soft wall steering
        if (p.x < 50) p.vx += 0.05
        if (p.x > cssWidth - 50) p.vx -= 0.05

        // Smoothly relax stretch back to 1.0 (round circle) quickly
        p.stretch += (1.0 - p.stretch) * 0.12

        p.vx *= 0.96
        p.vy *= 0.995
        // Enforce guaranteed continuous upward speed floor so trails never stall or hover
        if (p.vy > -0.65) p.vy = -0.65

        p.x += p.vx
        p.y += p.vy
        p.life -= 1

        // Wrap main bubbles exiting top back to bottom — preserving continuous 100-bubble stream without waves
        if (p.y < -60) {
          p.x = Math.random() * cssWidth
          p.y = cssHeight + 20 + Math.random() * 40
          p.vx = (Math.random() - 0.5) * 0.4
          p.vy = -(isMobile ? (0.50 + Math.random() * 0.35) : (1.25 + Math.random() * 0.85))
          p.life = p.maxLife = 1600
          const minR = isMobile ? 12 : Math.max(24, 4.5 * pixelSize)
          p.radius = minR + Math.random() * (isMobile ? 10 : 16)
          p.targetRadius = p.radius
          p.stretch = 1.0
          p.angle = 0
        }
        if (p.x < 0 || p.x > cssWidth) p.vx *= -0.5
      })

      // Render density field grid matrix for the bubbles themselves (original raster grid appearance)
      cols = Math.ceil(cssWidth / pixelSize)
      rows = Math.ceil(cssHeight / pixelSize)

      const densityField = Array.from({ length: rows }, () => new Float32Array(cols).fill(0))
      const colorRField = Array.from({ length: rows }, () => new Float32Array(cols).fill(0))
      const colorGField = Array.from({ length: rows }, () => new Float32Array(cols).fill(0))
      const colorBField = Array.from({ length: rows }, () => new Float32Array(cols).fill(0))
      const activeParticles = particles.filter(p => p.life > 0 && p.radius >= 6)

      // 1. Accumulate particle density onto pixel grid matrix
      activeParticles.forEach(p => {
        const rx = p.radius * p.stretch
        const ry = p.radius / Math.sqrt(p.stretch)
        const maxR = Math.max(rx, ry)
        const cellR = Math.ceil(maxR / pixelSize)
        const cx = Math.floor(p.x / pixelSize)
        const cy = Math.floor(p.y / pixelSize)
        const cosA = Math.cos(-p.angle)
        const sinA = Math.sin(-p.angle)
        const col = p.color || DEMON_PALETTE[0]

        for (let dy = -cellR; dy <= cellR; dy++) {
          for (let dx = -cellR; dx <= cellR; dx++) {
            const gx = cx + dx
            const gy = cy + dy
            if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
              const cellCenterX = (gx + 0.5) * pixelSize
              const cellCenterY = (gy + 0.5) * pixelSize
              const relX = cellCenterX - p.x
              const relY = cellCenterY - p.y
              const px = relX * cosA - relY * sinA
              const py = relX * sinA + relY * cosA
              const distSq = (px * px) / (rx * rx) + (py * py) / (ry * ry)
              if (distSq <= 1.0) {
                const inf = 1.0 - Math.sqrt(distSq)
                densityField[gy][gx] += inf
                colorRField[gy][gx] += col.r * inf
                colorGField[gy][gx] += col.g * inf
                colorBField[gy][gx] += col.b * inf
              }
            }
          }
        }
      })

      // 2. Accumulate liquid neck density for combining main bubbles
      const mainParticles = activeParticles.filter(p => p.radius >= 18)
      for (let i = 0; i < mainParticles.length; i++) {
        const p1 = mainParticles[i]
        const r1 = p1.radius

        for (let j = i + 1; j < mainParticles.length; j++) {
          const p2 = mainParticles[j]
          const r2 = p2.radius

          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const neckStartDist = (r1 + r2) * 1.2

          if (Math.abs(dx) > neckStartDist || Math.abs(dy) > neckStartDist) continue

          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 0 && dist < neckStartDist) {
            const overlapRatio = Math.max(0, Math.min(1, (neckStartDist - dist) / (neckStartDist * 0.45)))
            const steps = 6
            for (let s = 1; s < steps; s++) {
              const t = s / steps
              const nx = p1.x + dx * t
              const ny = p1.y + dy * t
              const baseR = r1 * (1 - t) + r2 * t

              const col1 = p1.color || DEMON_PALETTE[0]
              const col2 = p2.color || DEMON_PALETTE[0]
              const ncR = col1.r * (1 - t) + col2.r * t
              const ncG = col1.g * (1 - t) + col2.g * t
              const ncB = col1.b * (1 - t) + col2.b * t

              const bridgeProfile = 1.15 - 0.20 * Math.sin(t * Math.PI)
              const waistFactor = bridgeProfile * (0.60 + 0.45 * overlapRatio)
              const neckR = baseR * waistFactor

              if (neckR > 2.0) {
                const nCellR = Math.ceil(neckR / pixelSize)
                const nCx = Math.floor(nx / pixelSize)
                const nCy = Math.floor(ny / pixelSize)

                for (let ndy = -nCellR; ndy <= nCellR; ndy++) {
                  for (let ndx = -nCellR; ndx <= nCellR; ndx++) {
                    const gx = nCx + ndx
                    const gy = nCy + ndy
                    if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
                      const dSq = (ndx * pixelSize) ** 2 + (ndy * pixelSize) ** 2
                      if (dSq <= neckR * neckR) {
                        const inf = (1.0 - Math.sqrt(dSq) / neckR) * 2.2
                        densityField[gy][gx] += inf
                        colorRField[gy][gx] += ncR * inf
                        colorGField[gy][gx] += ncG * inf
                        colorBField[gy][gx] += ncB * inf
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 3. Render balanced high-performance dithered pixel grid (60 FPS dotSize = 2.2)!
      ctx.globalAlpha = 1.0
      const dotSize = 2.2

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const d = densityField[gy][gx]
          if (d > 0.10) {
            // Steeper, harder density curve for crisp, sharp flame boundaries
            const normD = Math.max(0, Math.min(1, (d - 0.10) / 0.38))

            // Concentric Japanese Demonic Shader (Hard Flame Edges & Sharp Onibi Dither):
            let cellR, cellG, cellB

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

            // High-performance cell shortcut for mobile only; desktop renders full sub-dot dither texture!
            if (isMobile && normD >= 0.45) {
              ctx.fillRect(gx * pixelSize, gy * pixelSize, pixelSize, pixelSize)
            } else {
              const dotsX = Math.ceil(pixelSize / dotSize)
              const dotsY = Math.ceil(pixelSize / dotSize)

              for (let sy = 0; sy < dotsY; sy++) {
                for (let sx = 0; sx < dotsX; sx++) {
                  const px = gx * pixelSize + sx * dotSize
                  const py = gy * pixelSize + sy * dotSize
                  const ditherX = Math.floor(px / dotSize)
                  const ditherY = Math.floor(py / dotSize)
                  const threshold = BAYER_8X8[ditherY % 8][ditherX % 8]

                  if (normD > threshold * 0.70) {
                    ctx.fillRect(px, py, dotSize - 0.1, dotSize - 0.1)
                  }
                }
              }
            }
          }
        }
      }

      mouseVelocityRef.current.x *= 0.9
      mouseVelocityRef.current.y *= 0.9
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      clearTimeout(initTimer)
      if (resizeObserver) resizeObserver.disconnect()
      window.removeEventListener('resize', resizeCanvas)
      if (parentElement) {
        parentElement.removeEventListener('mousemove', handleMouseMove)
        parentElement.removeEventListener('touchmove', handleTouchMove)
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [preview])

  return (
    <canvas
      ref={canvasRef}
      className={`ferrofluid-canvas ${className ?? ''}`}
      style={{ mixBlendMode: 'normal', borderRadius: 'inherit', pointerEvents: 'none' }}
    />
  )
}
