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
  const logoRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    let scale = 1;

    // Load logo image
    const logo = new Image();
    logo.src = "/scaict.webp";
    logo.onload = () => {
      logoRef.current = logo;
    };

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

      // Draw faint grid lines
      ctx.strokeStyle = "hsla(0, 0%, 100%, 0.02)";
      ctx.lineWidth = 1.5;
      const gridSize = 40;

      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Draw centered logo in background with reduced opacity
      if (logoRef.current) {
        const logo = logoRef.current;
        const maxLogoWidth = width * 0.28; // Logo takes up 28% of canvas width (reduced from 40%)
        const maxLogoHeight = height * 0.28; // Logo takes up 28% of canvas height (reduced from 40%)

        // Calculate scaled dimensions while maintaining aspect ratio
        const logoAspect = logo.width / logo.height;
        let logoWidth = maxLogoWidth;
        let logoHeight = logoWidth / logoAspect;

        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * logoAspect;
        }

        const logoX = (width - logoWidth) / 2;
        const logoY = (height - logoHeight) / 2;

        ctx.save();
        ctx.globalAlpha = 0.15; // Semi-transparent so it stays in background
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
        ctx.restore();
      }

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
