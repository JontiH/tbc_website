// Mock API for local development without Google credentials.
//
// Implements the four /api/* endpoints the real Cloudflare Worker serves,
// plus /cdn-cgi/access/get-identity. Reads seed data from the JSON files
// next to this script; hive-data is held in memory so POSTs to
// /api/hive-form-submit show up immediately on subsequent /api/hive-data
// requests.
//
// No auth, no caching. Built for offline dev only.
//
// Run via docker compose (see docker-compose.yml `mock` profile) or
// directly:  node mocks/server.mjs

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "8788", 10);

// Resolve the email returned by /cdn-cgi/access/get-identity. Lookup order:
//   1. MOCK_IDENTITY_EMAIL env var (explicit override from compose / shell)
//   2. user.email in the repo's .git/config  (mounted at /host/repo-gitconfig)
//   3. user.email in ~/.gitconfig            (mounted at /host/global-gitconfig)
//   4. dev@example.test                      (final fallback)
function parseGitUserEmail(path) {
  if (!path || !existsSync(path)) return null;
  let inUserSection = false;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    if (line.startsWith("[")) {
      // Section heading like [user] or [remote "origin"]
      inUserSection = /^\[\s*user\s*(\]|"\s*\])/.test(line);
      continue;
    }
    if (inUserSection) {
      const m = line.match(/^email\s*=\s*(.+?)\s*$/);
      if (m) return m[1];
    }
  }
  return null;
}

function resolveMockEmail() {
  if (process.env.MOCK_IDENTITY_EMAIL) {
    return { email: process.env.MOCK_IDENTITY_EMAIL, source: "MOCK_IDENTITY_EMAIL env" };
  }
  const repoEmail = parseGitUserEmail("/host/repo-gitconfig");
  if (repoEmail) return { email: repoEmail, source: "repo .git/config" };
  const globalEmail = parseGitUserEmail("/host/global-gitconfig");
  if (globalEmail) return { email: globalEmail, source: "global ~/.gitconfig" };
  return { email: "dev@example.test", source: "fallback default" };
}

const { email: MOCK_EMAIL, source: MOCK_EMAIL_SOURCE } = resolveMockEmail();

// ── Seed data ────────────────────────────────────────────────────────────
const hiveForm  = JSON.parse(readFileSync(join(HERE, "hive-form.json"), "utf8"));
const members   = JSON.parse(readFileSync(join(HERE, "members.json"),   "utf8"));
const seedHive  = JSON.parse(readFileSync(join(HERE, "hive-data.json"), "utf8"));

// In-memory rows. Submissions append here; never persisted to disk.
const hiveRows = [...seedHive.rows];

// ── Helpers ──────────────────────────────────────────────────────────────
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type":  "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin":      "*",
    "Access-Control-Allow-Credentials": "true",
  });
  res.end(payload);
}

function notFound(res, msg = "Not found") {
  json(res, 404, { error: msg });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  ()  => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Mimic the Worker's UTC timestamp format ("M/D/YYYY H:MM:SS")
function workerTimestamp() {
  const d = new Date();
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()} `
       + `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

// ── Routes ───────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url    = new URL(req.url, `http://${req.headers.host}`);
  const path   = url.pathname.replace(/\/$/, "");
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":      "*",
      "Access-Control-Allow-Methods":     "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":     "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    });
    res.end();
    return;
  }

  // Stand-in for Cloudflare Access identity endpoint.
  // The real endpoint lives at /cdn-cgi/access/get-identity on every
  // Access-protected domain and returns { email, ... } for the logged-in user.
  if (path === "/cdn-cgi/access/get-identity" && method === "GET") {
    return json(res, 200, { email: MOCK_EMAIL });
  }

  // Strip the /api prefix so we match the same handler names as the Worker.
  const apiPath = path.replace(/^\/api/, "");

  if (method === "GET" && apiPath === "/hive-data") {
    return json(res, 200, { rows: hiveRows });
  }

  if (method === "GET" && apiPath === "/members") {
    return json(res, 200, members);
  }

  if (method === "GET" && apiPath === "/hive-form") {
    return json(res, 200, hiveForm);
  }

  if (method === "POST" && apiPath === "/hive-form-submit") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { error: "Invalid JSON body" });
    }

    // Mimic the Worker's CSRF check
    if (req.headers["sec-fetch-site"] === "cross-site") {
      return json(res, 403, { error: "Cross-site POST not allowed" });
    }

    // Build a row matching the JS-key shape returned by /hive-data
    const row = {
      timestamp:  workerTimestamp(),
      date:       body.date       ?? "",
      location:   body.location   ?? "",
      colony:     body.colony     ?? "",
      status:     body.status     ?? "",
      treatment:  body.treatment  ?? "",
      feed:       body.feed       ?? "",
      mite_count: body.mite_count ?? "",
      comments:   body.comments   ?? "",
    };
    hiveRows.push(row);
    console.log(`[mock] appended hive row: ${row.date}  ${row.location}  colony=${row.colony}  (${hiveRows.length} total)`);
    return json(res, 200, { ok: true });
  }

  notFound(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mock] listening on http://0.0.0.0:${PORT}`);
  console.log(`[mock] identity email: ${MOCK_EMAIL}  (from ${MOCK_EMAIL_SOURCE})`);
  console.log(`[mock] seeded with ${hiveRows.length} hive rows, ${members.rows.length} members`);
});
