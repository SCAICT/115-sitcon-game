"use client";

import { useRef, useEffect } from "react";

// Render a single drawing's strokes onto the canvas context
function renderDrawing(ctx, drawing, scale) {
  ctx.save();
  ctx.translate(drawing.x * scale, drawing.y * scale);
  ctx.rotate(drawing.rotation);
  ctx.scale(drawing.scale * scale, drawing.scale * scale);
  ctx.globalAlpha = drawing.opacity;

  for (const stroke of drawing.strokes) {
    if (stroke.points.length < 2) continue;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = 8;

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      const prev = stroke.points[i - 1];
      const curr = stroke.points[i];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export default function DisplayCanvas() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    world: { width: 1920, height: 1080 },
    drawings: [],
  });
  const animIdRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    let scale = 1;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(
        window.devicePixelRatio,
        0,
        0,
        window.devicePixelRatio,
        0,
        0,
      );

      // Compute uniform scale from world to canvas while preserving aspect ratio
      const world = stateRef.current.world;
      const sx = width / world.width;
      const sy = height / world.height;
      scale = Math.min(sx, sy);
    }

    resize();
    window.addEventListener("resize", resize);

    // Subscribe to authoritative server state
    let es;
    try {
      es = new EventSource("/api/stream");
      es.addEventListener("state", (evt) => {
        try {
          const next = JSON.parse(evt.data);
          stateRef.current = next;
        } catch {}
      });
    } catch {}

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Dark background with subtle gradient
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        width * 0.7,
      );
      grad.addColorStop(0, "hsl(168, 15%, 6%)");
      grad.addColorStop(1, "hsl(0, 0%, 3%)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Render drawings from authoritative state
      const { drawings } = stateRef.current;
      for (const d of drawings) {
        renderDrawing(ctx, d, scale);
      }

      animIdRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (es) es.close();
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
}
