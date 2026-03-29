# AGENTS.md — Context for AI Coding Agents

This file provides context for AI agents (OpenCode, Claude, etc.) working on this codebase.
Read this before making changes.

---

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
│   └── logo.png                 # TBC logo — ADD THIS FILE (not yet in repo)
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
| `GET /members` | Members list Google Sheet | Returns raw `{ headers, rows }` — frontend renders dynamically |

### Hive data column mapping

The Worker renames verbose Google Form column headers to short keys for the frontend:

| Sheet column | JS key |
|---|---|
| `Where is the hive located?` | `location` |
| `Which Colony are you checking (A,B,C...)?` | `colony` |
| `How would you describe the holistic status of this hive?` | `status` |
| `What is the mite count?` | `mite_count` |
| `Are you doing a mite treatment?` | `treatment` |
| `Are you adding feed?` | `feed` |
| `if you are adding feed, what type?` | `feed_type` |
| `additional comments for this colony` | `comments` |
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
| `HIVE_SHEET_ID` | Google Sheet ID for hive notes |
| `HIVE_SHEET_RANGE` | Sheet range, e.g. `Sheet1!A:L` |
| `MEMBERS_SHEET_ID` | Google Sheet ID for member list |
| `MEMBERS_SHEET_RANGE` | Sheet range, e.g. `Sheet1!A:Z` |

---

## Development

```bash
# Requires Node.js v22+
npm install
cp .env.example .env    # fill in HIVE_WORKER_URL
npm run dev             # http://localhost:4321
npm run build           # production build → dist/
```

---

## Deployment

Pushing to `main` triggers an automatic Cloudflare Pages build and deploy.

The Worker is deployed separately:
```bash
cd worker
npx wrangler deploy
```

See `SETUP.md` for full first-time setup instructions.

---

## What's Deferred / Stubbed

| Item | Status | Notes |
|---|---|---|
| **Members list schema** | Awaiting sheet headers from client | Worker endpoint exists; frontend auto-renders any columns |
| **Hive photos/video** | Deferred | Column exists in sheet data; not displayed in UI yet |
| **Logo file** | Awaiting upload | Place at `public/logo.png`; referenced in `Nav.astro` |
| **Custom domain** | Post-deploy | Point `torontobeekeeping.ca` to Cloudflare Pages once live |
| **Cache busting** | Future | Currently requires Worker redeploy; could add query param handler |

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
