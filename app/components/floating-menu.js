"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DrawingCanvas from "@/components/drawing-canvas";

const COLORS = [
  "#2dd4bf",
  "#f472b6",
  "#818cf8",
  "#facc15",
  "#fb923c",
  "#f87171",
  "#34d399",
  "#e879f9",
  "#ffffff",
];

export default function FloatingMenu({ onSubmit }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(3);
  const [showSuccess, setShowSuccess] = useState(false);
  const drawingCanvasRef = useRef(null);

  function handleClear() {
    if (drawingCanvasRef.current) {
      drawingCanvasRef.current.clear();
    }
  }

  async function handleSubmit() {
    if (drawingCanvasRef.current) {
      const strokes = drawingCanvasRef.current.getStrokes();
      if (strokes.length === 0) return;

      try {
        await onSubmit({
          strokes,
          createdAt: new Date().toISOString(),
        });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1200);
      } catch (e) {
        console.error("Failed to submit drawing", e);
      }
      drawingCanvasRef.current.clear();
      setIsOpen(false);
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${
          isOpen
            ? "rotate-45 bg-secondary text-foreground shadow-lg"
            : "bg-[hsl(168,80%,50%)] text-[hsl(0,0%,4%)] shadow-[0_0_24px_hsla(168,80%,50%,0.35)] hover:shadow-[0_0_32px_hsla(168,80%,50%,0.5)] hover:scale-110"
        }`}
        aria-label={isOpen ? "Close drawing panel" : "Open drawing panel"}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawing Panel */}
      <div
        className={`fixed z-40 bottom-0 left-1/2 -translate-x-1/2 w-full sm:w-[600px] md:w-[700px] transition-all duration-500 ease-out ${
          isOpen
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-card m-3 sm:m-4 rounded-2xl border border-border shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-foreground text-base font-semibold">
                畫些什麼吧
              </h2>
              <p className="text-muted-foreground text-xs mt-0.5">
                您畫的東西會出現在大螢幕上！
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Close panel"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Drawing Area */}
          <div className="px-5 pt-4">
            <DrawingCanvas
              ref={drawingCanvasRef}
              color={selectedColor}
              lineWidth={lineWidth}
            />
          </div>

          {/* Controls */}
          <div className="px-5 py-4 space-y-4">
            {/* Color Picker */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                顏色
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full transition-all duration-200 ${
                      selectedColor === color
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Line Width */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                {"筆觸大小"}
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: selectedColor,
                    transform: `scale(${0.3 + (lineWidth / 20) * 0.7})`,
                  }}
                />
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">
                  {lineWidth}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                清除全部
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[hsl(168,80%,50%)] text-[hsl(0,0%,4%)] hover:brightness-110 transition-all shadow-[0_0_16px_hsla(168,80%,50%,0.25)]"
              >
                {showSuccess ? "已送出!" : "送出"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
