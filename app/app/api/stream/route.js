import { addClient, removeClient } from "@/lib/sse";
import { ensureStarted, getState } from "@/lib/sim";

export const runtime = "nodejs";

export async function GET(request) {
  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk) => controller.enqueue(chunk);

      // Register client
      addClient(send);

      // Ensure simulation ticker is running
      ensureStarted();

      // Send an initial comment/ping
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Immediately send the current authoritative state
      try {
        const payload = {
          event: "state",
          data: JSON.stringify(getState()),
        };
        const chunk = encoder.encode(
          `event: ${payload.event}\ndata: ${payload.data}\n\n`,
        );
        controller.enqueue(chunk);
      } catch {}

      // Heartbeat to keep connections alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(interval);
        }
      }, 25000);

      // Handle client disconnect
      const signal = request.signal;
      signal.addEventListener("abort", () => {
        removeClient(send);
        clearInterval(interval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // CORS for cross-device during dev
      "access-control-allow-origin": "*",
    },
  });
}
