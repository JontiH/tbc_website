# TBC Website

Toronto Beekeepers Collective — Astro static site + Cloudflare Worker API.
Read this before making changes.

## Project Overview

This is the website for the **Toronto Beekeepers Collective (TBC)**, a non-profit urban
beekeeping club based in Toronto, Canada. It replaces a clunky WordPress site at
[torontobeekeeping.ca](https://torontobeekeeping.ca).

**Key goals:**
- Clean, modern static site with a honeycomb/amber aesthetic matching the TBC logo
- Low maintenance: content updates happen in Google Sheets, not in code
- Members-only section protected by Cloudflare Access (email OTP)
- Hosted on Cloudflare Pages (free tier)

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | **Astro** (static output) | Fast static HTML, deploys perfectly to Cloudflare Pages |
| Styling | Plain CSS (global.css) | No framework needed; custom design system |
| Charts | **Chart.js** (CDN ESM import) | Client-side, no bundle bloat |
| Data API | **Cloudflare Worker** | Proxies/caches Google Sheets API; keeps credentials server-side |
| Auth | **Cloudflare Access** (OTP) | Free for ≤50 users; email OTP, no passwords to manage |
| Hosting | **Cloudflare Pages** | Free tier, auto-deploy on push to `main` |

---

## Repository Structure

```
tbc_website/
├── src/
│   ├── layouts/
│   │   └── Base.astro          # HTML shell: head, meta, font, slot for nav/footer
│   ├── components/
│   │   ├── Nav.astro            # Sticky top nav with mobile toggle
│   │   └── Footer.astro         # Site footer with link columns
│   ├── styles/
│   │   └── global.css           # Full design system — colours, typography, components
│   └── pages/
│       ├── index.astro          # Public landing page
│       ├── about.astro          # About, history timeline, bee yards, FAQ accordion
│       ├── membership.astro     # Membership info, requirements, timeline, perks
│       └── members/
│           ├── index.astro      # Members area hub (protected by Cloudflare Access)
│           ├── hive-data.astro  # Hive visit chart + filterable table (fetches Worker)
│           └── members-list.astro  # Member list table (fetches Worker; schema TBD)
├── worker/
│   ├── index.js                 # Cloudflare Worker source
│   └── wrangler.toml            # Worker deploy config
├── public/
│   ├── favicon.svg
│   └── logo.png                 # TBC logo (downloaded from torontobeekeeping.ca)
├── astro.config.mjs
├── package.json
├── .env.example
├── SETUP.md                     # One-time setup instructions (Google Cloud, CF Access, etc.)
└── AGENTS.md                    # This file
```

---

## Design System

Defined in `src/styles/global.css`. All values use CSS custom properties.

### Colours

| Variable | Value | Usage |
|---|---|---|
| `--amber` | `#F5A623` | Primary brand colour, CTAs, nav accent |
| `--amber-dark` | `#D4881A` | Hover states, headings in amber contexts |
| `--amber-light` | `#FDE9C0` | Backgrounds for highlight boxes, hex accents |
| `--charcoal` | `#2B2B2B` | Primary text, dark backgrounds |
| `--charcoal-mid` | `#555555` | Secondary/muted text |
| `--cream` | `#FFF8EE` | Page background |
| `--border` | `#E8D9B8` | Card/input borders |
| `--status-good` | `#2E7D32` | Green — healthy hive |
| `--status-mid` | `#F57F17` | Amber/yellow — okay hive |
| `--status-bad` | `#C62828` | Red — concerning hive |

### Key CSS classes

- `.container` — max-width wrapper (1100px), horizontal padding
- `.section` / `.section-alt` — page sections with standard vertical padding
- `.card` / `.card-grid` — white card component and auto-fit grid
- `.btn`, `.btn-primary`, `.btn-outline`, `.btn-outline-dark` — button variants
- `.badge`, `.badge-good`, `.badge-mid`, `.badge-bad` — status badge pills
- `.page-header` — dark header band with hexagonal SVG background
- `.hero` — full-width dark hero with hexagonal background
- `.table-wrap` / `table` — styled responsive table
- `.filters` — filter bar with `.filter-group` children
- `.timeline` / `.timeline-item` — vertical timeline for history page
- `.faq-item` / `.faq-question` / `.faq-answer` — accessible accordion

---

## Google Sheets Integration

### Architecture

```
Browser → Cloudflare Worker (/hive-data or /members) → Google Sheets API v4
                ↑
         1-hour cache (Cloudflare Cache API)
```

### Worker endpoints

| Endpoint | Sheet | Notes |
|---|---|---|
| `GET /hive-data` | Hive notes Google Form responses | Strips `Email address` column; renames columns to short keys |
| `GET /members` | Members list Google Sheet | Returns `{ headers, rows }` — frontend renders dynamically |

### Hive data column mapping

The Worker renames verbose Google Form column headers to short keys for the frontend:

| Sheet column | JS key |
|---|---|
| `Where is the hive located?` | `location` |
| `Which Colony are you checking (A,B,C...)?` | `colony` |
| `How would you describe the holistic status of this hive?` | `status` |
| `What is the mite count? ( leave blank if you didn't check)` | `mite_count` |
| `Are you doing a mite treatment? if so what type of treament?` | `treatment` |
| `Are you adding feed? if so, what type of feed?` | `feed` |
| `additional comments for this colony` | `comments` |
| `Do you have any pictures/video of the hive to share?` | `photos` |
| `Date of Visit` | `date` |
| `Timestamp` | `timestamp` |
| `Email address` | *(stripped — never sent to browser)* |

### Status normalisation

Hive status is a free-text field. `hive-data.astro` normalises it to `good/mid/bad/unknown`
using keyword matching in `normaliseStatus()`. If the field is changed to a dropdown with
fixed choices, update this function accordingly.

### Worker authentication

The Worker uses a Google Service Account (RS256 JWT → OAuth2 token exchange) implemented
entirely with the Web Crypto API (`crypto.subtle`) — no Node.js dependencies. Secrets are
stored as Cloudflare Worker secrets (never in code or env files).

---

## Members Area

Routes under `/members/*` are protected by **Cloudflare Access** at the Cloudflare edge.
The Astro site itself has no auth logic — Access intercepts requests before they reach the
static files and shows a login page for unapproved visitors.

**Auth method:** One-time PIN (OTP) sent to the member's email address.
**User management:** Done in the Cloudflare Zero Trust dashboard — edit the Access policy
email list when members join or leave. No code changes needed.
**Session duration:** Configurable in the Access policy (default: 24 hours).

### Members sheet columns

`Name`, `Email`, `Phone Number`, `Committees`, `Partner liaison`, `Swarm Brigade`, `Nearest Intersection`

- `Committees` and `Swarm Brigade` are comma-separated values — rendered as stacked amber tags in the UI
- Rows are objects keyed by header name (not by index) — use `row[header]` not `row[i]`

---

## Environment Variables

| Variable | Where used | Description |
|---|---|---|
| `HIVE_WORKER_URL` | Astro build / `.env` | Base URL of the deployed Cloudflare Worker |

Worker secrets (set via `wrangler secret put`, never in files):

| Secret | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account `client_email` from JSON key |
| `GOOGLE_PRIVATE_KEY` | Service account `private_key` from JSON key |

Non-secret config lives in `worker/wrangler.toml` under `[vars]` — version controlled, no secrets needed:

| Key | Value |
|---|---|
| `CACHE_VER` | `2` (increment to bust all edge caches — see Caching section) |
| `HIVE_SHEET_ID` | `1p-D7_nLmrNIFZyfRJcRO-d_u3PjaSeySLxd6rh5iMGA` |
| `HIVE_SHEET_RANGE` | `Form responses 1!A:K` |
| `MEMBERS_SHEET_ID` | `1_0gi606_DPJunKEDMx7v6KRwrZA1uVG9f7Cumr2XCqQ` |
| `MEMBERS_SHEET_RANGE` | `TBC Memberships 2024!A:Z` |

**Other non-secret config:**

| Key | Value |
|---|---|
| Cloudflare Account ID | `7679249973b3ca7cd658c198c69e1e5e` |
| Google Service Account | `tbc-sheets-reader@tbc-website-491722.iam.gserviceaccount.com` |

Tab names with spaces must be single-quoted in the Sheets API range — handled by `quoteRange()` in `worker/index.js`.

---

## Development

```bash
# Requires Node.js v22+
npm install
cp .env.example .env    # fill in HIVE_WORKER_URL
npm run dev             # http://localhost:4321
npm run build           # production build → dist/
```

Node.js on the host may be v18 (too old for wrangler). Use Docker for all wrangler operations.

---

## Docker Development

A Docker Compose setup runs both Astro and the Worker locally against real Google Sheets.

**Key gotchas — read before touching docker-compose:**

- Single root `.env` file used by both containers (no separate `worker/.env`)
- **Astro** uses `node:22-alpine` (fine — no native binaries)
- **Worker** must use `node:22-slim` (Debian) — Alpine's musl libc breaks wrangler's `workerd` binary
- Worker needs `ca-certificates` installed — `workerd` does its own TLS and won't work without it
- Worker container has **no volume mount** — a volume mount shadows wrangler's downloaded `workerd` binary and breaks it
- `entrypoint.sh` writes `.dev.vars` from environment variables before starting `wrangler dev`
- `GOOGLE_PRIVATE_KEY` in `.dev.vars` must be a single quoted line with literal `\n` — achieved via `awk '{printf "%s\\n", $0}'` in `entrypoint.sh`
- `HIVE_WORKER_URL` must be `http://localhost:8787` in docker-compose — the URL is baked into client-side JS, so it must be resolvable by the browser, not Docker
- `wrangler dev` flags: use `--ip 0.0.0.0` (not `--host`), and do NOT use `--local` (deprecated in wrangler v3+)
- Old `docker-compose` v1 has a `ContainerConfig` KeyError bug when recreating containers — always `docker-compose down` before `up --build`

---

## Deployment

### Cloudflare Pages (site)

Pushing to `main` auto-deploys via the `deploy-pages.yml` GitHub Action.

- Pages project: `tbc-website`
- Production URL: `https://tbc-website-btd.pages.dev`
- Custom domain: `https://tbchivecheck.ca`
- Build command: `npm run build`
- Build env: `HIVE_WORKER_URL=https://tbc-sheets-worker.jbhmario.workers.dev`

### Cloudflare Worker (API)

The Worker is deployed separately via the `deploy-worker.yml` GitHub Action on push to `main` (paths: `worker/**`).

- Worker name: `tbc-sheets-worker`
- Worker URL: `https://tbc-sheets-worker.jbhmario.workers.dev`

To deploy manually:
```bash
cd worker
npx wrangler deploy
```

See `SETUP.md` for full first-time setup instructions.

---

## GitHub Actions (CI/CD)

Worker deploy is triggered on push to `main` (paths: `worker/**`) and via manual `workflow_dispatch`.

**Key details:**
- Uses `actions/setup-node@v4` with `node-version: 22` — not the `container:` approach
- Secrets are passed to `wrangler secret put` via `printf '%s'` not `echo` — avoids corrupting the multi-line PEM key
- The `Set secrets` step has an `if: success()` guard so it doesn't run if the deploy itself fails
- Only 3 GitHub Secrets needed now: `CLOUDFLARE_API_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` — sheet IDs/ranges are in `wrangler.toml` vars
- Pages deploy (`deploy-pages.yml`) is triggered on all `main` pushes **except** `worker/**` changes
- Worker deploy (`deploy-worker.yml`) is triggered only on `worker/**` changes

---

## What's Deferred / Stubbed

| Item | Status | Notes |
|---|---|---|
| **Hive photos/video** | Deferred | Column exists in sheet data; not displayed in UI yet |
| **Custom domain** | Post-deploy | Point `torontobeekeeping.ca` to Cloudflare Pages once live |
| **Cloudflare Access** | Pending | Add OTP email auth protecting `/members/*` |

---

## Caching

The Worker uses Cloudflare's Cache API (`caches.default`) to cache Google Sheets responses for 1 hour server-side. Key design decisions and gotchas:

- **Browser caching is disabled** — the Worker returns `Cache-Control: no-store` to clients. Caching is handled entirely server-side. This prevents browsers from holding stale empty responses.
- **Cache key includes `CACHE_VER` and sheet ID** — so changing either automatically busts the edge cache without needing to purge manually.
- **To bust the cache**: increment `CACHE_VER` in `worker/wrangler.toml` and push. The worker redeploys and all edge nodes start fresh.
- **workers.dev cache is not purgeable via API** — the `workers.dev` subdomain is not a user-managed Cloudflare zone, so the standard cache purge API doesn't work for it. `CACHE_VER` is the escape hatch.
- **Different Cloudflare edge nodes have separate caches** — a cache hit on one edge doesn't mean another edge has it. This is why curl and a browser can return different results during a transition.

---

## DNS

- Domain `tbchivecheck.ca` is registered at **Hover** but uses **Cloudflare nameservers** for DNS (`rayne.ns.cloudflare.com`, `woz.ns.cloudflare.com`)
- Cloudflare Zone ID: `6483c778b21c665836110a7c9c173aec`
- DNS record: `CNAME @ → tbc-website-btd.pages.dev` (proxied) — Cloudflare flattens CNAME at apex
- MX record kept for Hover email hosting
- The API token has Zone DNS Edit + Zone Read permissions — DNS records can be managed via the Cloudflare API

---

## Cloudflare API Token

The token in `.env` as `CLOUDFLARE_API_TOKEN` has these permissions:

- Workers Scripts: Edit
- Cloudflare Pages: Edit
- Account Settings: Read
- Zone - DNS: Edit
- Zone - Zone: Read
- Access: Apps and Policies: Edit

---

## Key Decisions

- **No server-side rendering**: The site is fully static. All dynamic content (charts, tables)
  is fetched client-side from the Worker. This keeps hosting free and simple.
- **Email hidden from frontend**: The Worker strips the `Email address` column from hive data
  before returning JSON. It is never sent to the browser, even for authenticated members.
- **Client-side filtering**: All hive data filtering (location, colony, date, status) happens
  in the browser after the Worker returns the full dataset. This is appropriate for the
  expected data volume (~50 members × a few visits/year).
- **Chart.js via CDN ESM**: Avoids bundling Chart.js into the Astro build. Loaded on demand
  only on the hive-data page.
- **No framework (React/Vue/Svelte)**: Not needed. Interactive elements (accordion, mobile nav,
  charts, filters) are implemented with plain vanilla JS in `<script>` blocks.
- **Git identity**: This repo uses the `JontiH` GitHub account with the `~/.ssh/JontiH` key,
  configured as a local git override (not global). See `git config --local --list`.
- **Date format from Google Sheets**: Dates arrive as `DD/MM/YYYY`. JavaScript's `new Date()` cannot parse this — use the custom `parseDate()` in `hive-data.astro` which handles it explicitly.
- **Sheet IDs are not secrets**: `HIVE_SHEET_ID`, `HIVE_SHEET_RANGE`, etc. are in `wrangler.toml` as `[vars]`, not Cloudflare secrets. Only the Google credentials (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) are secrets.
