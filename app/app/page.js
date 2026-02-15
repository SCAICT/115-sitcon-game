"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import DisplayCanvas from "@/components/display-canvas";
import FloatingMenu from "@/components/floating-menu";
import DisplayModeIndicator from "@/components/display-mode-indicator";

function DrawingWallContent() {
  const searchParams = useSearchParams();
  const isDisplayMode = searchParams.get("mode") === "display";
  const [submissions, setSubmissions] = useState([]);

  // Load existing submissions and subscribe to live updates
  useEffect(() => {
    let es;
    async function init() {
      try {
        const res = await fetch("/api/strokes", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data.submissions)) {
          setSubmissions(data.submissions);
        }
      } catch {}

      try {
        es = new EventSource("/api/stream");
        es.addEventListener("new", (evt) => {
          try {
            const submission = JSON.parse(evt.data);
            setSubmissions((prev) => [...prev, submission]);
          } catch {}
        });
      } catch {}
    }
    init();
    return () => {
      if (es) es.close();
    };
  }, []);

  async function handleSubmit(drawing) {
    try {
      await fetch("/api/strokes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(drawing),
      });
      // No local update needed; SSE will broadcast
    } catch {}
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-background">
      <DisplayCanvas submissions={submissions} />
      {isDisplayMode ? (
        <DisplayModeIndicator />
      ) : (
        <FloatingMenu onSubmit={handleSubmit} />
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="relative w-screen h-screen overflow-hidden bg-background" />
      }
    >
      <DrawingWallContent />
    </Suspense>
  );
}
