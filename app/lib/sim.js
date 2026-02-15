// Global simulation state and ticker for synchronized drawings
// Authoritative positions/rotation are computed server-side and broadcast via SSE.

import { broadcast } from "@/lib/sse";
import { promises as fs } from "fs";
import path from "path";

// Fixed virtual world size for consistent coordinates across devices
const WORLD_WIDTH = 1920;
const WORLD_HEIGHT = 1080;

// Singleton state
let started = false;
let drawings = [];
let timer = null;

// Seeded RNG for deterministic initial placement per submission
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededBetween(rng, min, max) {
  return min + rng() * (max - min);
}

function makeDrawingFromSubmission(submission) {
  const rng = mulberry32(submission.id || Date.now());
  const pad = 80;
  return {
    id: submission.id,
    strokes: submission.strokes,
    x: seededBetween(rng, pad, WORLD_WIDTH - pad),
    y: seededBetween(rng, pad, WORLD_HEIGHT - pad),
    vx: seededBetween(rng, -1.5, 1.5),
    vy: seededBetween(rng, -1.5, 1.5),
    scale: seededBetween(rng, 0.6, 1.1),
    rotation: seededBetween(rng, 0, Math.PI * 2),
    rotationSpeed: seededBetween(rng, -0.005, 0.005),
    opacity: seededBetween(rng, 0.7, 1.0),
  };
}

async function initializeFromDisk() {
  try {
    const dataPath = path.join(process.cwd(), "data", "strokes.json");
    const buf = await fs.readFile(dataPath, "utf8");
    const submissions = JSON.parse(buf || "[]");
    if (Array.isArray(submissions)) {
      drawings = submissions.map(makeDrawingFromSubmission);
    } else {
      drawings = [];
    }
  } catch {
    drawings = [];
  }
}

function tickOnce() {
  const pad = 80;
  for (const d of drawings) {
    d.x += d.vx;
    d.y += d.vy;
    d.rotation += d.rotationSpeed;

    if (d.x < pad || d.x > WORLD_WIDTH - pad) d.vx *= -1;
    if (d.y < pad || d.y > WORLD_HEIGHT - pad) d.vy *= -1;

    d.x = Math.max(pad, Math.min(WORLD_WIDTH - pad, d.x));
    d.y = Math.max(pad, Math.min(WORLD_HEIGHT - pad, d.y));
  }

  // Broadcast full authoritative state
  broadcast("state", {
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    drawings,
  });
}

export async function ensureStarted() {
  if (started) return;
  started = true;
  await initializeFromDisk();
  // 30 FPS ticker
  timer = setInterval(() => {
    try {
      tickOnce();
    } catch (e) {
      // If something goes wrong, stop the loop to avoid spamming
      clearInterval(timer);
      timer = null;
      started = false;
    }
  }, 33);
}

export function getState() {
  return { world: { width: WORLD_WIDTH, height: WORLD_HEIGHT }, drawings };
}

export function addSubmission(submission) {
  const d = makeDrawingFromSubmission(submission);
  drawings.push(d);
  // Emit an immediate state update so clients reflect quickly
  broadcast("state", {
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    drawings,
  });
}
