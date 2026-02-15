// Simple in-memory SSE broadcaster shared across route handlers

const clients = new Set();

function addClient(send) {
  clients.add(send);
}

function removeClient(send) {
  clients.delete(send);
}

function broadcast(event, data) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const chunk = encoder.encode(payload);
  for (const send of clients) {
    try {
      send(chunk);
    } catch {
      // drop broken client
      clients.delete(send);
    }
  }
}

export { addClient, removeClient, broadcast };
