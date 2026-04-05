# TBC Website

Toronto Beekeepers Collective — Astro static site + Cloudflare Worker API.
Read this before making changes.

## Project Overview

Website for the **Toronto Beekeepers Collective (TBC)**, a non-profit urban beekeeping club in Toronto. Replaces a WordPress site at [torontobeekeeping.ca](https://torontobeekeeping.ca).

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
│   │   ├── Footer.astro           # 3-column site footer (Bee Yards = 3 active locations)
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
│   ├── index.js                   # Cloudflare Worker source
│   ├── wrangler.toml              # Worker deploy config + non-secret vars
│   ├── Dockerfile                 # node:22-slim (Debian) + ca-certificates + wrangler
│   └── entrypoint.sh              # Writes .dev.vars from env, starts wrangler dev
├── public/
│   ├── favicon.ico                # Multi-size ICO (16/32/48px) from original TBC logo
│   ├── favicon-192.png            # 192×192 PNG for modern browsers
│   ├── apple-touch-icon.png       # 180×180 PNG for iOS home screen
│   └── logo.png                   # Full TBC logo (hexagon + Toronto skyline + wordmark)
├── Dockerfile                     # Multi-stage: dev / build / preview (node:22-alpine)
├── docker-compose.yml             # Astro dev + Worker containers
├── astro.config.mjs
├── package.json
└── .env.example                   # Template — only HIVE_WORKER_URL
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
| `/members/hive-check` | `pages/members/hive-check.astro` | Dynamic hive check submission form |
| `/members/members-list` | `pages/members/members-list.astro` | Member list table with search and column filter |

**Active yards (3):** Downsview Park, Black Creek Community Farm, Fairmont Royal York Hotel. The Ontario Science Centre closed 2023/2024 and appears only in the history timeline on `/about`.

---

## Components

- **`Base.astro`** — HTML shell. Accepts `title`, `description`, `ogImage` props. Loads Inter from Google Fonts. Named slots: `nav`, default (main), `footer`. Constructs canonical URL from `Astro.site`. Favicon links: `favicon.ico` (all browsers), `favicon-192.png` (modern), `apple-touch-icon.png` (iOS).
- **`Nav.astro`** — Sticky top nav. Logo image only (no text label), 4 links (Home, About, Membership, Members Area). Members Area link styled as `.nav-cta` (amber fill). Mobile hamburger toggle in vanilla JS. Accepts `currentPath` prop for active state.
- **`Footer.astro`** — Dark charcoal footer. Columns: About/contact, Navigate, Members links, Bee Yards (3 active locations only). Copyright year and Gmail address in footer bottom bar.
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
| `GET` | `/hive-form` | Fetches hive check form structure from Google Forms API. Skips `file_upload` questions. Returns `{ formId, title, description, submitUrl, responderUri, items }`. Cached 1 hour. |
| `POST` | `/hive-form-submit` | Accepts JSON body, appends a row (A:Timestamp, B:Email, C:Date, D:Location, E:Colony, F:Status, G:Treatment, H:Feed, I:Mite count, J:Comments) to hive sheet. Not cached. |
| `OPTIONS` | `*` | CORS preflight — returns 204 with CORS headers. |

### Hive data column mapping

| Sheet column | JS key |
|---|---|
| `Where is the hive located?` | `location` |
| `Which Colony are you checking (A,B,C...)?` | `colony` |
| `How would you describe the holistic status of this hive?` | `status` |
| `What is the mite count? ( leave blank if you didn't check)` | `mite_count` |
| `Are you doing a mite treatment? if so what type of treament?` | `treatment` |
| `Are you adding feed? if so, what type of feed?` | `feed` |
| `additional comments for this colony` | `comments` |
| `Date of Visit` | `date` |
| `Timestamp` | `timestamp` |
| `Email address` | *(stripped — never sent to browser)* |

Column K (`Do you have any pictures/video...`) is hidden in the sheet and excluded from the Worker range (`A:J`). Google prevents deletion of form-linked columns.

### Status normalisation

Hive status is a free-text radio field. `hive-data.astro` normalises it to `strong/neutral/weak/unknown` using keyword matching in `normaliseStatus()`.

### Worker authentication

The Worker uses a Google Service Account (RS256 JWT → OAuth2 token exchange) implemented entirely with the Web Crypto API (`crypto.subtle`) — no Node.js dependencies. Secrets are stored as Cloudflare Worker secrets (never in code or env files).

OAuth2 scopes used:
- `spreadsheets.readonly` — for `/hive-data` and `/members`
- `spreadsheets` (read+write) — for `/hive-form-submit`
- `forms.body.readonly` — for `/hive-form`

---

## Members Area

Routes under `/members/*` are protected by **Cloudflare Access** at the Cloudflare edge. The Astro site itself has no auth logic.

**Auth method:** One-time PIN (OTP) sent to the member's email address.
**User management:** Automated — `sync-access-policy.yml` runs nightly and syncs emails from the members Sheet to the CF Access allow policy.
**Session duration:** Configurable in the Access policy (default: 24 hours).

### Members sheet columns

`Name`, `Email`, `Phone Number`, `Committees`, `Partner liaison`, `Swarm Brigade`, `Nearest Intersection`

- `Committees` and `Swarm Brigade` are comma-separated values
- Rows are objects keyed by header name — use `row[header]` not `row[i]`

---

## Environment Variables

| Variable | Where used | Description |
|---|---|---|
| `HIVE_WORKER_URL` | Astro build / `.env` | Base URL of the deployed Cloudflare Worker |
| `CF_ACCESS_CLIENT_ID` | `.env` / curl scripts | Service token ID for bypassing CF Access in scripts |
| `CF_ACCESS_CLIENT_SECRET` | `.env` / curl scripts | Service token secret |

Worker secrets (set via `wrangler secret put`, never in files):

| Secret | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account `client_email` from JSON key |
| `GOOGLE_PRIVATE_KEY` | Service account `private_key` from JSON key |

Non-secret config in `worker/wrangler.toml` under `[vars]`:

| Key | Value |
|---|---|
| `CACHE_VER` | `3` (increment to bust all edge caches) |
| `HIVE_SHEET_ID` | `1p-D7_nLmrNIFZyfRJcRO-d_u3PjaSeySLxd6rh5iMGA` |
| `HIVE_SHEET_RANGE` | `Form responses 1!A:J` |
| `MEMBERS_SHEET_ID` | `1_0gi606_DPJunKEDMx7v6KRwrZA1uVG9f7Cumr2XCqQ` |
| `MEMBERS_SHEET_RANGE` | `TBC Memberships 2024!A:Z` |
| `HIVE_FORM_ID` | `1r_lj8nvUjM9avrTvlrb9Zd_V0WldP7eUOdUiSH01Jac` |

**Other non-secret config:**

| Key | Value |
|---|---|
| Cloudflare Account ID | `7679249973b3ca7cd658c198c69e1e5e` |
| Cloudflare Zone ID | `6483c778b21c665836110a7c9c173aec` |
| Google Service Account | `tbc-sheets-reader@tbc-website-491722.iam.gserviceaccount.com` |
| CF Access App ID | `40f844bc-ff6b-4669-9ec7-22b4a52cf825` |
| CF Access Policy ID (email allow) | `d4a7448f-d652-4b66-b8da-a687077ab066` |
| CF Access Service Token ID | `0fac5f0c-1094-4a1f-a2bb-8dd7eeef1e14` (name: `opencode-dev`, expires 2027-04-05) |

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

### Docker

A Docker Compose setup runs both Astro and the Worker locally against real Google Sheets.

**Key gotchas:**
- Single root `.env` file used by both containers
- **Worker** must use `node:22-slim` (Debian) — Alpine's musl libc breaks wrangler's `workerd` binary
- Worker needs `ca-certificates` installed — `workerd` does its own TLS
- Worker container has **no volume mount** — a volume mount shadows wrangler's downloaded `workerd` binary
- `entrypoint.sh` writes `.dev.vars` from environment variables before starting `wrangler dev`
- `GOOGLE_PRIVATE_KEY` in `.dev.vars` must be a single quoted line with literal `\n` — achieved via `awk '{printf "%s\\n", $0}'` in `entrypoint.sh`
- `HIVE_WORKER_URL` must be `http://localhost:8787` — baked into client-side JS, must be resolvable by the browser
- `wrangler dev` flags: use `--ip 0.0.0.0` (not `--host`), do NOT use `--local` (deprecated in wrangler v3+)
- Old `docker-compose` v1 has a `ContainerConfig` KeyError bug — always `docker-compose down` before `up --build`

---

## Deployment

### Cloudflare Pages (site)

Pushing to `main` auto-deploys via `deploy-pages.yml`.

- Pages project: `tbc-website`
- Production URL: `https://tbc-website-btd.pages.dev`
- Custom domain: `https://tbchivecheck.ca`
- Build command: `npm run build`
- Build env: `HIVE_WORKER_URL=https://tbc-sheets-worker.jbhmario.workers.dev`

### Cloudflare Worker (API)

Deployed via `deploy-worker.yml` on push to `main` (paths: `worker/**`).

- Worker name: `tbc-sheets-worker`
- Worker URL: `https://tbc-sheets-worker.jbhmario.workers.dev`

---

## GitHub Actions (CI/CD)

**`deploy-pages.yml`** — Triggers on push to `main` (excluding `worker/**`) and `workflow_dispatch`.

**`deploy-worker.yml`** — Triggers on push to `main` (only `worker/**`) and `workflow_dispatch`. Sets Google secrets via `wrangler secret put` on each deploy.

**`sync-access-policy.yml`** — Triggers nightly at 05:00 UTC (midnight Toronto EDT) and `workflow_dispatch`.
- Fetches `/members` from the live Worker, extracts all `Email` values, builds a CF Access allow-policy JSON, and `PUT`s it to the Cloudflare API.
- **Does not check for changes before running** — always does a full PUT even if the member list is unchanged. This is a known inefficiency (see Next Steps).
- **Overwrites the email allow policy entirely** — the service token bypass lives in a separate `non_identity` policy so it survives the nightly sync. Do not merge it into the email policy.

---

## Caching

- **Browser caching is disabled** — Worker returns `Cache-Control: no-store`. All caching is server-side.
- **`POST /hive-form-submit` is never cached** — always hits the Sheets API directly.
- **Cache key includes `CACHE_VER` and sheet/form ID** — changing either busts the edge cache automatically.
- **To bust the cache**: increment `CACHE_VER` in `worker/wrangler.toml` and push.
- **`workers.dev` cache is not purgeable via API** — `CACHE_VER` is the only escape hatch.
- **Different edge nodes have separate caches** — curl and a browser may return different results during a transition.

---

## DNS

- Domain `tbchivecheck.ca` registered at **Hover**, nameservers at **Cloudflare** (`rayne.ns.cloudflare.com`, `woz.ns.cloudflare.com`)
- DNS: `CNAME @ → tbc-website-btd.pages.dev` (proxied) — Cloudflare flattens CNAME at apex
- MX record kept for Hover email hosting

### Cloudflare API Token permissions

- Workers Scripts: Edit
- Cloudflare Pages: Edit
- Account Settings: Read
- Zone - DNS: Edit / Zone: Read
- Access: Apps and Policies: Edit

---

## Key Decisions & Gotchas

- **No server-side rendering**: Fully static. All dynamic content fetched client-side from the Worker.
- **Email hidden from frontend**: Worker strips the `Email address` column from hive data — never sent to the browser.
- **Client-side filtering**: All hive data filtering happens in the browser after the Worker returns the full dataset.
- **No framework**: Interactive elements (accordion, mobile nav, charts, filters, form rendering) are plain vanilla JS in `<script>` blocks.
- **Git identity**: Repo uses `JontiH` GitHub account with `~/.ssh/JontiH` key, configured as a local git override (not global). See `git config --local --list`.
- **Date format from Google Sheets**: Dates arrive as `DD/MM/YYYY`. Use the custom `parseDate()` in `hive-data.astro` — `new Date()` cannot parse this format.
- **Sheet IDs are not secrets**: Only `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` are Worker secrets. Sheet IDs/ranges/form ID live in `wrangler.toml`.
- **Hive check form is dynamically rendered**: `hive-check.astro` fetches form structure from `/hive-form` at runtime and builds the form in JS. `file_upload` questions are filtered out server-side. The member's email is read from `GET /cdn-cgi/access/get-identity` (a Cloudflare endpoint on any Access-protected domain) — `CF_Authorization` is HttpOnly and cannot be read via `document.cookie`.
- **Access policy is code-driven**: `sync-access-policy.yml` manages the allowed email list automatically. The CF Access App ID and Policy ID are hardcoded in the workflow YAML.
- **Hive photos/video removed**: Google Form question deleted April 2026. Sheet column K is hidden (Google prevents deletion of form-linked columns). Worker range trimmed to `A:J`.
- **Astro CSS scoping**: `<style>` blocks are scoped by default — dynamically created DOM elements (via `document.createElement`) never get the scope attribute. Use `<style is:global>` for styles targeting JS-created elements.
- **Astro external CSS + SVG filter IDs**: `filter: url('#id')` in an external CSS file may resolve the fragment against the CSS file's URL, not the document. Set SVG filter references via `element.style.filter` in JS — inline styles always resolve against `document.baseURI`.
- **SVG filter visibility**: `display:none` on an SVG prevents its `<filter>` / `<defs>` from being usable. Use `position:absolute; width:0; height:0; overflow:hidden` instead.
- **Uniform clip-path borders**: Two stacked `clip-path: polygon()` elements with different heights cannot produce a uniform border — diagonal slopes differ. Use an SVG `feMorphology operator="dilate"` filter on a *parent* element (filter must be on the parent, not the clipped element itself — CSS applies `filter` before `clip-path` on the same element).
- **Accessing CF Access-protected pages from scripts**: Use the `opencode-dev` service token. Pass `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers. Credentials in `.env` as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`. Example: `curl -Ls -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" https://tbchivecheck.ca/members/hive-check`

---

## Next Steps

- **Mobile optimisation**: Review all pages on small screens. Known areas to check: hive-check form section cards, hex pill wrapping, hive-data filter bar, members-list table, nav hamburger menu.
- **Bug hunt**: General QA pass across all pages — look for layout breaks, JS errors, missing data edge cases (empty hive data, missing fields in member rows).
- **Nightly sync change detection**: `sync-access-policy.yml` currently does a blind PUT every night. It should fetch the current policy first, diff it against the member list, and skip the PUT if nothing changed. This saves API calls and avoids unnecessary policy churn.
- **Worker timestamp timezone**: `new Date()` in the Worker is UTC. Google Form submissions use Toronto local time. Submissions via the custom form will have timestamps offset from real Google Form submissions by up to 5 hours. Fix by formatting the timestamp in `America/Toronto` timezone using `Intl.DateTimeFormat`.
- **Stale WORKER_URL fallback in hive-data and members-list**: The fallback URL in `hive-data.astro` and `members-list.astro` is `https://tbc-sheets-worker.YOUR_SUBDOMAIN.workers.dev` — a placeholder that will fail if `HIVE_WORKER_URL` is not set at build time. Update to the real Worker URL like `hive-check.astro` already does.
- **Form submission error uses `alert()`**: `hive-check.astro` calls `alert()` on submission failure. This is ugly and inconsistent with the rest of the UI. Replace with an inline error state below the submit button.
- **Members sheet range year is hardcoded**: `MEMBERS_SHEET_RANGE = "TBC Memberships 2024!A:Z"` in `wrangler.toml`. If the sheet tab is renamed (e.g. for 2025), the Worker will break silently. Either rename the tab to something year-agnostic or add a note to update this each year.
- **No custom 404 page**: Astro generates a default 404 that won't match the site design. Add a `src/pages/404.astro` matching the site's style.
- **OG / social sharing images**: No `og:image` is set for any page. Adding page-specific OG images would improve link previews when members share the site.
- **New Google Form URL**: The public Google Form URL was not regenerated/closed — anyone with the old link can still submit directly to the sheet, bypassing the website form. Consider creating a new Form (updating `HIVE_FORM_ID`) or closing the existing one in the Google Forms UI to disable direct submissions.
