// Global simulation state and ticker for synchronized drawings
// Authoritative positions/rotation are computed server-side and broadcast via SSE.

import { broadcast } from "@/lib/sse";
import { promises as fs } from "fs";
import path from "path";

// Fixed virtual world size for consistent coordinates across devices
const WORLD_WIDTH = 1920;
const WORLD_HEIGHT = 1080;
const EXPIRY_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Singleton state
let started = false;
let drawings = [];
let timer = null;
let lastCleanupAt = 0;

const DATA_PATH = path.join(process.cwd(), "data", "strokes.json");

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
    createdAt: submission.createdAt,
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

function getSubmissionCreatedAtMs(submission) {
  if (submission && typeof submission.createdAt === "string") {
    const parsed = Date.parse(submission.createdAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (submission && typeof submission.id === "number") {
    return submission.id;
  }
  return 0;
}

function isExpiredByMs(createdAtMs, nowMs = Date.now()) {
  return nowMs - createdAtMs > EXPIRY_MS;
}

function isSubmissionExpired(submission, nowMs = Date.now()) {
  return isExpiredByMs(getSubmissionCreatedAtMs(submission), nowMs);
}

async function persistCurrentDrawings() {
  const submissions = drawings.map((d) => ({
    id: d.id,
    createdAt: d.createdAt,
    strokes: d.strokes,
  }));

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(submissions, null, 2), "utf8");
}

async function cleanupExpiredDrawings(nowMs = Date.now()) {
  const next = drawings.filter(
    (d) => !isExpiredByMs(getSubmissionCreatedAtMs(d), nowMs),
  );
  if (next.length === drawings.length) return;

  drawings = next;
  await persistCurrentDrawings();
  broadcast("state", {
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    drawings,
  });
}

async function initializeFromDisk() {
  try {
    const buf = await fs.readFile(DATA_PATH, "utf8");
    const submissions = JSON.parse(buf || "[]");
    if (Array.isArray(submissions)) {
      const nowMs = Date.now();
      const valid = submissions.filter((s) => !isSubmissionExpired(s, nowMs));
      drawings = valid.map(makeDrawingFromSubmission);

      if (valid.length !== submissions.length) {
        await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
        await fs.writeFile(DATA_PATH, JSON.stringify(valid, null, 2), "utf8");
      }
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
      const nowMs = Date.now();
      if (nowMs - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
        lastCleanupAt = nowMs;
        // Fire-and-forget cleanup while swallowing async errors for loop stability.
        cleanupExpiredDrawings(nowMs).catch(() => {});
      }
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
  if (isSubmissionExpired(submission)) return;

  const d = makeDrawingFromSubmission(submission);
  drawings.push(d);
  // Emit an immediate state update so clients reflect quickly
  broadcast("state", {
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    drawings,
  });
}
