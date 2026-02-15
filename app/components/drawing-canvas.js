"use client"

import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react"

const DrawingCanvas = forwardRef(function DrawingCanvas({ color, lineWidth }, ref) {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const strokesRef = useRef([])
  const currentStrokeRef = useRef(null)
  const [strokeCount, setStrokeCount] = useState(0)

  // Expose clear and getStrokes to parent
  useImperativeHandle(ref, () => ({
    clear() {
      strokesRef.current = []
      currentStrokeRef.current = null
      setStrokeCount(0)
      redraw()
    },
    getStrokes() {
      return [...strokesRef.current]
    },
  }))

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.clearRect(0, 0, w, h)

    // Subtle grid background
    ctx.strokeStyle = "hsla(0, 0%, 100%, 0.03)"
    ctx.lineWidth = 0.5
    const gridSize = 20
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Draw all strokes
    const allStrokes = [...strokesRef.current]
    if (currentStrokeRef.current) allStrokes.push(currentStrokeRef.current)

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue

      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.lineWidth
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.shadowColor = stroke.color
      ctx.shadowBlur = 6

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1]
        const curr = stroke.points[i]
        const mx = (prev.x + curr.x) / 2
        const my = (prev.y + curr.y) / 2
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }, [])

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  function startDraw(e) {
    e.preventDefault()
    isDrawingRef.current = true
    const pos = getPos(e)
    currentStrokeRef.current = {
      color,
      lineWidth,
      points: [pos],
    }
  }

  function draw(e) {
    e.preventDefault()
    if (!isDrawingRef.current || !currentStrokeRef.current) return
    const pos = getPos(e)
    currentStrokeRef.current.points.push(pos)
    redraw()
  }

  function endDraw(e) {
    if (e) e.preventDefault()
    if (!isDrawingRef.current || !currentStrokeRef.current) return
    isDrawingRef.current = false

    if (currentStrokeRef.current.points.length > 1) {
      strokesRef.current.push(currentStrokeRef.current)
      setStrokeCount(strokesRef.current.length)
    }
    currentStrokeRef.current = null
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext("2d")
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    redraw()
  }, [redraw])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-border cursor-crosshair touch-none"
        style={{
          height: "280px",
          background: "hsl(0, 0%, 5%)",
        }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {strokeCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-muted-foreground/40 text-sm select-none">
            Draw here with your mouse or finger
          </p>
        </div>
      )}
    </div>
  )
})

export default DrawingCanvas
