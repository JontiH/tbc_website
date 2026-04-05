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
| Data API | **Cloudflare Worker** | Proxies/caches Google Sheets & Forms APIs; keeps credentials server-side |
| Auth | **Cloudflare Access** (OTP) | Free for ≤50 users; email OTP, no passwords to manage |
| Hosting | **Cloudflare Pages** | Free tier, auto-deploy on push to `main` |

---

## Repository Structure

```
tbc_website/
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml       # CI: build + deploy Astro to Cloudflare Pages
│       ├── deploy-worker.yml      # CI: deploy Worker + set secrets
│       └── sync-access-policy.yml # CI: nightly sync of member emails → CF Access
├── src/
│   ├── layouts/
│   │   └── Base.astro             # HTML shell: head, OG meta, Inter font, slot layout
│   ├── components/
│   │   ├── Nav.astro              # Sticky top nav with mobile hamburger toggle
│   │   ├── Footer.astro           # 4-column site footer
│   │   └── MembersNav.astro       # Dark sub-nav for all /members/* pages
│   ├── styles/
│   │   └── global.css             # Full design system — colours, typography, components
│   └── pages/
│       ├── index.astro            # Public landing page
│       ├── about.astro            # About, history timeline (1985–2024), bee yards, FAQ
│       ├── membership.astro       # Membership info, requirements, timeline, perks
│       └── members/
│           ├── index.astro        # Members area hub (3 section cards)
│           ├── hive-data.astro    # Hive visit explorer: calendar, chart, filterable table
│           ├── hive-check.astro   # Hive check submission form (fetches /hive-form Worker)
│           └── members-list.astro # Member list table (fetches /members Worker)
├── worker/
│   ├── index.js                   # Cloudflare Worker source (~310 lines)
│   ├── wrangler.toml              # Worker deploy config + non-secret vars
│   ├── Dockerfile                 # node:22-slim (Debian) + ca-certificates + wrangler
│   └── entrypoint.sh              # Writes .dev.vars from env, starts wrangler dev
├── public/
│   ├── favicon.ico                # Multi-size ICO (16/32/48px) from original TBC logo
│   ├── favicon-192.png            # 192×192 PNG for modern browsers
│   ├── favicon.svg                # Unused legacy placeholder
│   ├── apple-touch-icon.png       # 180×180 PNG for iOS home screen
│   └── logo.png                   # Full TBC logo (hexagon + Toronto skyline + wordmark)
├── Dockerfile                     # Multi-stage: dev / build / preview (node:22-alpine)
├── docker-compose.yml             # Astro dev + Worker containers
├── astro.config.mjs
├── package.json
├── .env.example                   # Template — only HIVE_WORKER_URL
├── SETUP.md                       # One-time setup instructions
└── AGENTS.md                      # This file
```

---

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `pages/index.astro` | Hero, stats bar, "What is TBC" section, bee yards cards, Join CTA |
| `/about` | `pages/about.astro` | Mission, history timeline (1985–2024), 3 active yards, FAQ accordion |
| `/membership` | `pages/membership.astro` | Application process, timeline, commitment grid, perks, callout |
| `/members` | `pages/members/index.astro` | Hub with 3 cards linking to Hive Data, Hive Check Form, Members List |
| `/members/hive-data` | `pages/members/hive-data.astro` | Filters, visit calendar heatmap, mite count scatter chart, sortable table |
| `/members/hive-check` | `pages/members/hive-check.astro` | Dynamic hive check submission form (renders from `/hive-form` endpoint) |
| `/members/members-list` | `pages/members/members-list.astro` | Member list table with search and column filter |

**Note:** Both `index.astro` and `about.astro` reflect 3 active yards. The Ontario Science Centre closed 2023/2024 and is recorded in the history timeline on the about page only.

---

## Components

- **`Base.astro`** — HTML shell. Accepts `title`, `description`, `ogImage` props. Loads Inter from Google Fonts. Named slots: `nav`, default (main), `footer`. Constructs canonical URL from `Astro.site`. Favicon links: `favicon.ico` (all browsers), `favicon-192.png` (modern), `apple-touch-icon.png` (iOS).
- **`Nav.astro`** — Sticky top nav. Logo image only (no text label), 4 links (Home, About, Membership, Members Area). Members Area link styled as `.nav-cta` (amber fill). Mobile hamburger toggle in vanilla JS. Accepts `currentPath` prop for active state.
- **`Footer.astro`** — Dark charcoal footer. 4 columns: About/contact, Navigate, Members links, Bee Yards. Copyright year and Gmail address in footer bottom bar.
- **`MembersNav.astro`** — Dark sub-navigation bar rendered below `.page-header` on all `/members/*` pages. 3 links: Hive Data, Hive Check Form, Members List. Amber active underline indicator.

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
| `--white` | `#FFFFFF` | |
| `--border` | `#E8D9B8` | Card/input borders |
| `--status-good` | `#2E7D32` | Green — strong hive |
| `--status-good-bg` | `#E8F5E9` | Green background for status badges |
| `--status-mid` | `#F57F17` | Amber/yellow — neutral hive |
| `--status-mid-bg` | `#FFF9C4` | Amber background for status badges |
| `--status-bad` | `#C62828` | Red — weak hive |
| `--status-bad-bg` | `#FFEBEE` | Red background for status badges |
| `--radius` | `8px` | Default border radius |
| `--shadow` | `0 2px 8px rgba(43,43,43,0.10)` | Card shadow |
| `--shadow-lg` | `0 4px 24px rgba(43,43,43,0.14)` | Elevated card shadow |
| `--max-width` | `1100px` | Container max width |

### Key CSS classes

- `.container` — max-width wrapper (1100px), horizontal padding
- `.section` / `.section-alt` — page sections with standard vertical padding; alt has white background
- `.section-header` — heading + subtext block with 2.5rem bottom margin
- `.card` / `.card-grid` — white card component and auto-fit grid (min 280px)
- `.btn`, `.btn-primary`, `.btn-outline`, `.btn-outline-dark` — button variants
- `.badge`, `.badge-good`, `.badge-mid`, `.badge-bad`, `.badge-unknown` — status badge pills
- `.page-header` — dark charcoal header with hexagonal SVG background
- `.hero` — full-width dark gradient hero with hexagonal background
- `.nav`, `.nav-inner`, `.nav-logo`, `.nav-links`, `.nav-toggle` — navigation
- `.table-wrap` / `table` — styled responsive table with dark thead
- `.filters` — filter bar with `.filter-group` children
- `.chart-container` / `.chart-title` — chart wrapper
- `.timeline` / `.timeline-item` / `.timeline-year` — vertical history timeline
- `.faq-item` / `.faq-question` / `.faq-answer` — accessible accordion (max-height animation)
- `.members-grid` / `.member-card` / `.member-card-icon` — members hub card layout
- `.hex-accent` — hexagonal clip-path icon container
- `.loading` / `.error-msg` — loading and error states
- Utilities: `.text-amber`, `.text-muted`, `.mt-1` through `.mt-4`, `.mb-0`

---

## Google Sheets & Forms Integration

### Architecture

```
Browser → Cloudflare Worker → Google Sheets API v4  (read hive data / members)
                           → Google Forms API v1    (read form structure)
                           → Google Sheets API v4   (append hive check submission)
                ↑
         1-hour server-side cache (Cloudflare Cache API)
```

### Worker endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/hive-data` | Fetches hive visit records. Strips `Email address`; maps verbose column names to short keys. Returns `{ rows }`. Cached 1 hour. |
| `GET` | `/members` | Fetches members list. Returns `{ headers, rows }` as-is. Cached 1 hour. |
| `GET` | `/hive-form` | Fetches hive check form structure from Google Forms API. Converts question types to clean JSON (`date`, `text`, `textarea`, `radio`, `checkbox`, `file_upload`). Converts hex questionId → decimal entryId. Returns `{ formId, title, description, submitUrl, responderUri, items }`. Cached 1 hour. |
| `POST` | `/hive-form-submit` | Accepts JSON body, constructs a row in sheet column order (A:Timestamp, B:Email, C:Date, D:Location, E:Colony, F:Status, G:Treatment, H:Feed, I:Mite count, J:Comments, K:Photos), appends to hive sheet via Sheets API `values.append`. Not cached. |
| `OPTIONS` | `*` | CORS preflight — returns 204 with CORS headers. |

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

Hive status is a free-text field. `hive-data.astro` normalises it to `strong/neutral/weak/unknown`
using keyword matching in `normaliseStatus()`. If the field is changed to a dropdown with
fixed choices, update this function accordingly.

### Worker authentication

The Worker uses a Google Service Account (RS256 JWT → OAuth2 token exchange) implemented
entirely with the Web Crypto API (`crypto.subtle`) — no Node.js dependencies. Secrets are
stored as Cloudflare Worker secrets (never in code or env files).

OAuth2 scopes used:
- `spreadsheets.readonly` — for `/hive-data` and `/members`
- `spreadsheets` (read+write) — for `/hive-form-submit`
- `forms.body.readonly` — for `/hive-form`

---

## Members Area

Routes under `/members/*` are protected by **Cloudflare Access** at the Cloudflare edge.
The Astro site itself has no auth logic — Access intercepts requests before they reach the
static files and shows a login page for unapproved visitors.

**Auth method:** One-time PIN (OTP) sent to the member's email address.
**User management:** Automated — the `sync-access-policy.yml` GitHub Action runs nightly
and syncs email addresses from the members Google Sheet directly to the Cloudflare Access
allow policy. No manual dashboard changes needed when members join or leave.
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
| `HIVE_FORM_ID` | `1r_lj8nvUjM9avrTvlrb9Zd_V0WldP7eUOdUiSH01Jac` |

**Other non-secret config:**

| Key | Value |
|---|---|
| Cloudflare Account ID | `7679249973b3ca7cd658c198c69e1e5e` |
| Google Service Account | `tbc-sheets-reader@tbc-website-491722.iam.gserviceaccount.com` |
| CF Access App ID | `40f844bc-ff6b-4669-9ec7-22b4a52cf825` |
| CF Access Policy ID | `d4a7448f-d652-4b66-b8da-a687077ab066` |

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

Three workflows live in `.github/workflows/`:

**`deploy-pages.yml`** — Triggers on push to `main` (excluding `worker/**`) and `workflow_dispatch`.
- Checkout → setup Node 22 → `npm install` → `npm run build` → `wrangler pages deploy dist --project-name=tbc-website`

**`deploy-worker.yml`** — Triggers on push to `main` (only `worker/**` paths) and `workflow_dispatch`.
- Checkout → setup Node 22 → install wrangler → `wrangler deploy` → (on success) `wrangler secret put` for both Google secrets via `printf '%s'` (safe for multi-line PEM key)
- Only 3 GitHub Secrets needed: `CLOUDFLARE_API_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` — sheet IDs/ranges/form ID are in `wrangler.toml` vars

**`sync-access-policy.yml`** — Triggers nightly at 05:00 UTC (midnight Toronto EDT) and `workflow_dispatch`.
- Fetches `/members` from the live Worker
- Extracts all `Email` values using Python3
- Builds a Cloudflare Access allow-policy JSON
- `PUT`s to the Cloudflare API to update the Access policy for the TBC Members Area app
- Verifies `success: true` in the response
- Automates member email management — no manual Zero Trust dashboard changes needed

---

## What's Deferred / Stubbed

| Item | Status | Notes |
|---|---|---|
| **Hive photos/video** | Deferred | `photos` column exists in sheet data and form; not displayed in the hive-data UI yet |
| **Custom domain** | Done | `tbchivecheck.ca` pointing to Cloudflare Pages |
| **Cloudflare Access** | Done | OTP email auth live; Access policy auto-synced nightly from members sheet |

---

## Caching

The Worker uses Cloudflare's Cache API (`caches.default`) to cache responses for 1 hour server-side. Key design decisions and gotchas:

- **Browser caching is disabled** — the Worker returns `Cache-Control: no-store` to clients. Caching is handled entirely server-side. This prevents browsers from holding stale empty responses.
- **`POST /hive-form-submit` is never cached** — it always hits the Sheets API directly.
- **Cache key includes `CACHE_VER` and sheet/form ID** — so changing either automatically busts the edge cache without needing to purge manually.
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

- **No server-side rendering**: The site is fully static. All dynamic content (charts, tables, forms)
  is fetched client-side from the Worker. This keeps hosting free and simple.
- **Email hidden from frontend**: The Worker strips the `Email address` column from hive data
  before returning JSON. It is never sent to the browser, even for authenticated members.
- **Client-side filtering**: All hive data filtering (location, colony, date, status) happens
  in the browser after the Worker returns the full dataset. This is appropriate for the
  expected data volume (~50 members × a few visits/year).
- **Chart.js via CDN ESM**: Avoids bundling Chart.js into the Astro build. Loaded on demand
  only on the hive-data page.
- **No framework (React/Vue/Svelte)**: Not needed. Interactive elements (accordion, mobile nav,
  charts, filters, form rendering) are implemented with plain vanilla JS in `<script>` blocks.
- **Git identity**: This repo uses the `JontiH` GitHub account with the `~/.ssh/JontiH` key,
  configured as a local git override (not global). See `git config --local --list`.
- **Date format from Google Sheets**: Dates arrive as `DD/MM/YYYY`. JavaScript's `new Date()` cannot parse this — use the custom `parseDate()` in `hive-data.astro` which handles it explicitly.
- **Sheet IDs are not secrets**: `HIVE_SHEET_ID`, `HIVE_SHEET_RANGE`, `HIVE_FORM_ID`, etc. are in `wrangler.toml` as `[vars]`, not Cloudflare secrets. Only the Google credentials (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) are secrets.
- **Hive check form is dynamically rendered**: `hive-check.astro` fetches form structure from `/hive-form` at runtime and renders all question types (radio, text, textarea, date, file_upload) in JS. `file_upload` questions show a fallback message since the Google Forms file upload API is not supported for programmatic submission.
- **Access policy is code-driven**: `sync-access-policy.yml` replaces manual Zero Trust dashboard edits. The allowed email list is always the source-of-truth members sheet. The CF Access App ID and Policy ID are hardcoded in the workflow YAML.
