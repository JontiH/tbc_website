/**
 * TBC Sheets + Forms Worker
 *
 * Endpoints:
 *   GET /hive-data   — hive visit records (email column stripped)
 *   GET /members     — member list (raw, as-is from sheet)
 *   GET /hive-form   — hive check form structure (from Google Forms API)
 *
 * Cache TTL: 1 hour (3600 seconds)
 */

const CACHE_TTL = 3600;

// ── CORS ─────────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders(origin) },
  });
}

function cacheableResponse(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}`, ...corsHeaders(origin) },
  });
}

function errorResponse(message, status = 500, origin) {
  return jsonResponse({ error: message }, status, origin);
}

// ── Google OAuth2 via service account ────────────────────────────────────────
async function getAccessToken(env, scope) {
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope,
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };

  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claim));
  const signingInput = `${header}.${payload}`;

  const pemBody = env.GOOGLE_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\r?\n/g, "");

  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sigBuf    = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const signature = b64urlBuf(sigBuf);
  const jwt       = `${signingInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });

  if (!tokenRes.ok) throw new Error(`OAuth token error: ${await tokenRes.text()}`);
  return (await tokenRes.json()).access_token;
}

function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function b64urlBuf(buf) {
  let str = "";
  new Uint8Array(buf).forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Sheets helpers ───────────────────────────────────────────────────────────
function quoteRange(range) {
  const bang = range.indexOf("!");
  if (bang === -1) return range;
  const tab = range.slice(0, bang), cells = range.slice(bang + 1);
  const quoted = (tab.includes(" ") || tab.includes("-")) && !tab.startsWith("'") ? `'${tab}'` : tab;
  return `${quoted}!${cells}`;
}

async function fetchSheetValues(sheetId, range, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(quoteRange(range))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  return (await res.json()).values ?? [];
}

function mapRows(values) {
  if (!values.length) return { headers: [], rows: [] };
  const [headerRow, ...dataRows] = values;
  const rows = dataRows.map(row => Object.fromEntries(headerRow.map((h, i) => [h, row[i] ?? ""])));
  return { headers: headerRow, rows };
}

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
  if (!values.length) return { rows: [] };
  const [headerRow, ...dataRows] = values;
  const stripIdx = new Set(headerRow.map((h, i) => HIVE_STRIP_COLUMNS.includes(h) ? i : -1).filter(i => i >= 0));
  const cleanHeaders = headerRow.filter((_, i) => !stripIdx.has(i)).map(h => HIVE_COLUMN_MAP[h] ?? h);
  const rows = dataRows
    .filter(row => row.some(c => c !== ""))
    .map(row => {
      const filtered = row.filter((_, i) => !stripIdx.has(i));
      return Object.fromEntries(cleanHeaders.map((h, i) => [h, filtered[i] ?? ""]));
    });
  return { rows };
}

// ── Forms API helper ─────────────────────────────────────────────────────────
async function fetchFormStructure(formId, token) {
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Forms API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Convert Forms API response to a clean structure the frontend can render.
// Entry IDs: questionId is hex → parseInt(hex, 16) = decimal entry ID for POST.
function processFormStructure(api) {
  const items = [];

  for (const item of api.items ?? []) {
    const q = item.questionItem?.question;
    if (!q) continue; // section headers, images, etc.

    const entryId = parseInt(q.questionId, 16);
    const base    = { entryId, title: item.title, required: q.required ?? false };

    if (q.dateQuestion) {
      items.push({ ...base, type: "date" });

    } else if (q.textQuestion) {
      items.push({ ...base, type: q.textQuestion.paragraph ? "textarea" : "text" });

    } else if (q.choiceQuestion) {
      const options = q.choiceQuestion.options.map(o => ({
        value:   o.value   ?? null,
        isOther: o.isOther ?? false,
      }));
      items.push({ ...base, type: q.choiceQuestion.type.toLowerCase(), options });

    } else if (q.fileUploadQuestion) {
      // File uploads can't be submitted via a custom form — flag so frontend can handle gracefully
      items.push({ ...base, type: "file_upload" });

    } else {
      items.push({ ...base, type: "unknown" });
    }
  }

  const submitUrl = (api.responderUri ?? "").replace("/viewform", "/formResponse");

  return {
    formId:      api.formId,
    title:       api.info?.title       ?? "",
    description: api.info?.description ?? "",
    submitUrl,
    responderUri: api.responderUri ?? "",
    items,
  };
}

// ── Sheet append helper ──────────────────────────────────────────────────────
// Columns A-K must match the form response sheet exactly:
// A:Timestamp  B:Email  C:Date  D:Location  E:Colony  F:Status
// G:Treatment  H:Feed   I:Mite count  J:Comments  K:Photos
async function appendHiveRow(sheetId, row, token) {
  const range = encodeURIComponent("Form responses 1!A:K");
  const url   = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res   = await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ values: [row] }),
  });
  if (!res.ok) throw new Error(`Sheets append error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const path = url.pathname.replace(/\/$/, "");

    // POST only allowed for the submit endpoint
    if (request.method === "POST") {
      if (path !== "/hive-form-submit") {
        return errorResponse("Method not allowed", 405, origin);
      }

      let body;
      try { body = await request.json(); }
      catch { return errorResponse("Invalid JSON body", 400, origin); }

      // Timestamp in Google Forms format: M/D/YYYY H:MM:SS
      const now = new Date();
      const ts  = `${now.getMonth()+1}/${now.getDate()}/${now.getFullYear()} `
                + `${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

      const row = [
        ts,                       // A: Timestamp
        body.email       ?? "",   // B: Email address
        body.date        ?? "",   // C: Date of Visit
        body.location    ?? "",   // D: Where is the hive located?
        body.colony      ?? "",   // E: Which Colony?
        body.status      ?? "",   // F: Holistic status
        body.treatment   ?? "",   // G: Mite treatment
        body.feed        ?? "",   // H: Feed
        body.mite_count  ?? "",   // I: Mite count
        body.comments    ?? "",   // J: Additional comments
        "",                       // K: Photos (not supported in custom form)
      ];

      try {
        const token = await getAccessToken(env, "https://www.googleapis.com/auth/spreadsheets");
        await appendHiveRow(env.HIVE_SHEET_ID, row, token);
        return jsonResponse({ ok: true }, 200, origin);
      } catch (err) {
        console.error("Submit error:", err);
        return errorResponse(`Submission failed: ${err.message}`, 500, origin);
      }
    }

    if (request.method !== "GET") {
      return errorResponse("Method not allowed", 405, origin);
    }

    // Build cache key — unique per endpoint + relevant ID
    const cacheId = path === "/hive-form" ? `form-${env.HIVE_FORM_ID ?? "form"}`
                  : path === "/hive-data"  ? (env.HIVE_SHEET_ID ?? "hive")
                  : (env.MEMBERS_SHEET_ID ?? "members");
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set("_v", `${env.CACHE_VER ?? "1"}-${cacheId}`);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache    = caches.default;
    const cached   = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      let response;

      if (path === "/hive-data") {
        const token  = await getAccessToken(env, "https://www.googleapis.com/auth/spreadsheets.readonly");
        const values = await fetchSheetValues(env.HIVE_SHEET_ID, env.HIVE_SHEET_RANGE ?? "Sheet1!A:L", token);
        response     = cacheableResponse(processHiveData(values), 200, origin);

      } else if (path === "/members") {
        const token  = await getAccessToken(env, "https://www.googleapis.com/auth/spreadsheets.readonly");
        const values = await fetchSheetValues(env.MEMBERS_SHEET_ID, env.MEMBERS_SHEET_RANGE ?? "Sheet1!A:Z", token);
        response     = cacheableResponse(mapRows(values), 200, origin);

      } else if (path === "/hive-form") {
        if (!env.HIVE_FORM_ID) return errorResponse("HIVE_FORM_ID not configured", 503, origin);
        const token  = await getAccessToken(env, "https://www.googleapis.com/auth/forms.body.readonly");
        const api    = await fetchFormStructure(env.HIVE_FORM_ID, token);
        response     = cacheableResponse(processFormStructure(api), 200, origin);

      } else {
        return errorResponse("Not found", 404, origin);
      }

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;

    } catch (err) {
      console.error("Worker error:", err);
      return errorResponse(`Internal error: ${err.message}`, 500, origin);
    }
  },
};
