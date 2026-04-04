/**
 * TBC Sheets Worker
 *
 * Proxies Google Sheets API v4 requests, caches responses,
 * and strips sensitive columns (Email address) before returning data.
 *
 * Endpoints:
 *   GET /hive-data   — hive visit records (email column stripped)
 *   GET /members     — member list (raw, as-is from sheet)
 *
 * Required Worker Secrets (set via wrangler secret put):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   — service account email
 *   GOOGLE_PRIVATE_KEY             — service account private key (PEM)
 *   HIVE_SHEET_ID                  — Google Sheet ID for hive notes
 *   HIVE_SHEET_RANGE               — e.g. "Sheet1!A:L"
 *   MEMBERS_SHEET_ID               — Google Sheet ID for member list
 *   MEMBERS_SHEET_RANGE            — e.g. "Sheet1!A:Z"
 *
 * Cache TTL: 1 hour (3600 seconds)
 */

const CACHE_TTL = 3600; // seconds

// ── CORS headers ────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL}`,
      ...corsHeaders(origin),
    },
  });
}

function errorResponse(message, status = 500, origin) {
  return jsonResponse({ error: message }, status, origin);
}

// ── Google OAuth2 token using service account ───────────────────────────────
// Workers don't have access to Node crypto — we use the SubtleCrypto Web API.

async function getAccessToken(env) {
  const now  = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };

  // Build JWT
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claim));
  const signingInput = `${header}.${payload}`;

  // Import the RSA private key
  const pemBody = env.GOOGLE_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\r?\n/g, "");

  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = b64urlBuf(signatureBuffer);
  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`OAuth token error: ${body}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlBuf(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Fetch sheet values ───────────────────────────────────────────────────────
function quoteRange(range) {
  // If the tab name contains spaces or special chars, wrap it in single quotes
  // e.g. "TBC Memberships - 2024!A:Z" → "'TBC Memberships - 2024'!A:Z"
  const bang = range.indexOf("!");
  if (bang === -1) return range;
  const tab = range.slice(0, bang);
  const cells = range.slice(bang + 1);
  const quoted = (tab.includes(" ") || tab.includes("-")) && !tab.startsWith("'")
    ? `'${tab}'`
    : tab;
  return `${quoted}!${cells}`;
}

async function fetchSheetValues(sheetId, range, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(quoteRange(range))}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.values ?? [];
}

// ── Map rows to objects using header row ─────────────────────────────────────
function mapRows(values) {
  if (values.length === 0) return { headers: [], rows: [] };
  const [headerRow, ...dataRows] = values;
  const rows = dataRows.map(row =>
    Object.fromEntries(headerRow.map((h, i) => [h, row[i] ?? ""]))
  );
  return { headers: headerRow, rows };
}

// ── Hive data: strip Email column, rename headers for frontend ───────────────
const HIVE_COLUMN_MAP = {
  "Where is the hive located?":                                              "location",
  "Which Colony are you checking (A,B,C...)?":                               "colony",
  "How would you describe the holistic status of this hive?":                "status",
  "What is the mite count? ( leave blank if you didn't check)":              "mite_count",
  "Are you doing a mite treatment? if so what type of treament?":            "treatment",
  "Are you adding feed? if so, what type of feed?":                          "feed",
  "additional comments for this colony":                                     "comments",
  "Do you have any pictures/video of the hive to share?":                    "photos",
  "Date of Visit":                                                           "date",
  "Timestamp":                                                               "timestamp",
};

const HIVE_STRIP_COLUMNS = ["Email address", "Email Address"];

function processHiveData(values) {
  if (values.length === 0) return { rows: [] };
  const [headerRow, ...dataRows] = values;

  // Indices to strip
  const stripIdx = new Set(
    headerRow
      .map((h, i) => (HIVE_STRIP_COLUMNS.includes(h) ? i : -1))
      .filter(i => i >= 0)
  );

  // Remap headers
  const cleanHeaders = headerRow
    .filter((_, i) => !stripIdx.has(i))
    .map(h => HIVE_COLUMN_MAP[h] ?? h);

  const rows = dataRows
    .filter(row => row.some(cell => cell !== "")) // skip blank rows
    .map(row => {
      const filtered = row.filter((_, i) => !stripIdx.has(i));
      return Object.fromEntries(cleanHeaders.map((h, i) => [h, filtered[i] ?? ""]));
    });

  return { rows };
}

// ── Worker fetch handler ─────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "*";

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "GET") {
      return errorResponse("Method not allowed", 405, origin);
    }

    const path = url.pathname.replace(/\/$/, "");

    // ── Cache key ──────────────────────────────────────────────────────
    const cacheKey = new Request(request.url, request);
    const cache    = caches.default;
    const cached   = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      let response;

      if (path === "/hive-data") {
        if (!env.HIVE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
          return errorResponse(
            "Worker not fully configured. Set HIVE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY secrets.",
            503, origin
          );
        }

        const token  = await getAccessToken(env);
        const range  = env.HIVE_SHEET_RANGE ?? "Sheet1!A:L";
        const values = await fetchSheetValues(env.HIVE_SHEET_ID, range, token);
        const data   = processHiveData(values);
        response     = jsonResponse(data, 200, origin);

      } else if (path === "/members") {
        if (!env.MEMBERS_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
          return errorResponse(
            "Worker not fully configured. Set MEMBERS_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY secrets.",
            503, origin
          );
        }

        const token  = await getAccessToken(env);
        const range  = env.MEMBERS_SHEET_RANGE ?? "Sheet1!A:Z";
        const values = await fetchSheetValues(env.MEMBERS_SHEET_ID, range, token);
        const { headers, rows } = mapRows(values);
        response = jsonResponse({ headers, rows }, 200, origin);

      } else {
        return errorResponse("Not found", 404, origin);
      }

      // Store in cache
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;

    } catch (err) {
      console.error("Worker error:", err);
      return errorResponse(`Internal error: ${err.message}`, 500, origin);
    }
  },
};
