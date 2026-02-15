import { promises as fs } from "fs";
import path from "path";
import { broadcast } from "@/lib/sse";
import { addSubmission } from "@/lib/sim";

export const runtime = "nodejs";

// Use the Next.js app root as CWD; data lives in ./data/strokes.json
const DATA_PATH = path.join(process.cwd(), "data", "strokes.json");

async function readStrokes() {
  try {
    const buf = await fs.readFile(DATA_PATH, "utf8");
    const data = JSON.parse(buf || "[]");
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, "[]", "utf8");
      return [];
    }
    throw err;
  }
}

async function writeStrokes(strokes) {
  await fs.writeFile(DATA_PATH, JSON.stringify(strokes, null, 2), "utf8");
}

export async function GET() {
  try {
    const strokes = await readStrokes();
    return new Response(JSON.stringify({ submissions: strokes }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to read strokes" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // Expect body like { strokes: [...] }
    if (!body || !Array.isArray(body.strokes)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const submissions = await readStrokes();
    const submission = { id: Date.now(), strokes: body.strokes };
    submissions.push(submission);
    await writeStrokes(submissions);

    // Update simulation state and broadcast
    try {
      addSubmission(submission);
    } catch {}

    // Optional: also broadcast a lightweight 'new' event
    broadcast("new", submission);

    return new Response(JSON.stringify({ ok: true, submission }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to write strokes" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
