# AGENTS.md

Technical reference for the TBC website. Read this before changing the
Worker, Cloudflare config, or anything to do with auth, data, or deploys.

For the user-facing overview, see [README.md](README.md).
For first-time setup, see [SETUP.md](SETUP.md).

## Architecture

```
Browser
  │
  ▼
torontobeekeeping.ca               (Cloudflare zone)
  │
  ├── /                            Cloudflare Pages (static Astro)
  ├── /about, /membership          Cloudflare Pages
  ├── /members/*                   Cloudflare Pages, gated by CF Access
  └── /api/*                       Cloudflare Worker, gated by CF Access
                                     │
                                     ├── Google Sheets API (read + append)
                                     └── Google Forms API (read structure)
```

The Worker lives on the same hostname as the site (`torontobeekeeping.ca/api/*`)
so browser fetches are first-party. An earlier setup using `api.torontobeekeeping.ca`
broke on iOS Safari, which dropped the cross-site `CF_Authorization` cookie and
caused "Failed to fetch" errors. Don't move the API back to a subdomain.

`tbchivecheck.ca` is a separate zone that 301-redirects every path to
`torontobeekeeping.ca/members/hive-check`. See the DNS section below.

## Worker endpoints

All paths are mounted under `/api/` in production. The Worker strips the
`/api` prefix internally.

| Method   | Path                    | Cached | Notes |
|----------|-------------------------|--------|-------|
| GET      | `/api/hive-data`        | 1h     | Strips the `Email address` column. Returns `{ rows }`. |
| GET      | `/api/members`          | 1h     | Returns `{ headers, rows }` as-is from the sheet. |
| GET      | `/api/hive-form`        | 1h     | Form structure from Google Forms API. Skips file-upload questions. |
| POST     | `/api/hive-form-submit` | no     | Appends a row to the hive sheet. Rejects `Sec-Fetch-Site: cross-site` with 403. |
| OPTIONS  | `*`                     | no     | CORS preflight. Same-origin browser fetches don't trigger this. |

### Hive data column mapping

The Worker translates verbose Google Form column names to short JS keys
in `processHiveData()`:

```
"Where is the hive located?"                                   → location
"Which Colony are you checking (A,B,C...)?"                    → colony
"How would you describe the holistic status of this hive?"     → status
"What is the mite count? ( leave blank if you didn't check)"   → mite_count
"Are you doing a mite treatment? if so what type of treament?" → treatment
"Are you adding feed? if so, what type of feed?"               → feed
"additional comments for this colony"                          → comments
"Date of Visit"                                                → date
"Timestamp"                                                    → timestamp
"Email address"                                                → STRIPPED (never sent to browser)
```

The submit endpoint writes back to columns A:J in the same order the
Google Form would. Column K (photos) is hidden in the sheet and not used.

### Worker auth to Google

Service account, RS256 JWT minted in the Worker using Web Crypto API
(`crypto.subtle`). No Node dependencies. Secrets live as Cloudflare
Worker secrets:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: service account `client_email`
- `GOOGLE_PRIVATE_KEY`: service account `private_key`

OAuth scopes:
- `spreadsheets.readonly` for hive-data and members
- `spreadsheets` (read+write) for hive-form-submit
- `forms.body.readonly` for hive-form

## Member auth

Cloudflare Access on the "TBC Members Area" app gates two path patterns:

- `torontobeekeeping.ca/members` (the static pages)
- `torontobeekeeping.ca/api` (the Worker)

Members log in with a one-time PIN sent by email. The allowed email list
is auto-synced nightly from the members Google Sheet by
`.github/workflows/sync-access-policy.yml`.

Scripts and CI bypass Access using the `opencode-dev` service token, which
lives in a separate `non_identity` policy on the same app so the nightly
email sync doesn't wipe it out.

## Caching

The Worker stores GET responses in Cloudflare's Cache API with a 1-hour
TTL. The cache lives on Cloudflare's edge servers, not in the browser:
the Worker sets `Cache-Control: no-store` so the browser never holds a
copy. Each Cloudflare data centre has its own independent cache, but
the cache within an edge is **shared across all users** hitting that
edge. For TBC, traffic effectively all hits the Toronto edge (`YYZ`),
so in practice it behaves like a single shared cache for the whole
club.

POST `/api/hive-form-submit` is never cached.

Cache keys are `CACHE_VER` + sheet/form ID and do not include the auth
cookie, so cached entries are reused across users. The Worker re-attaches
per-origin CORS headers on each serve (see `worker/index.js`). To
force-bust the cache, bump `CACHE_VER` in `worker/wrangler.toml` and
push.

After a hive-check submission, the new row exists in the Sheet
immediately but won't appear on `/api/hive-data` until that endpoint's
cache entry expires (between a few seconds and ~1 hour). If this lag
ever becomes a complaint, the cleanest fix is to have
`/api/hive-form-submit` explicitly delete the `/api/hive-data` cache
entry on success.

## Configuration

### Worker config (`worker/wrangler.toml`)

| Key                   | Value |
|-----------------------|-------|
| `CACHE_VER`           | `5` (bump to bust caches) |
| `HIVE_SHEET_ID`       | `1p-D7_nLmrNIFZyfRJcRO-d_u3PjaSeySLxd6rh5iMGA` |
| `HIVE_SHEET_RANGE`    | `Form responses 1!A:J` |
| `MEMBERS_SHEET_ID`    | `1_0gi606_DPJunKEDMx7v6KRwrZA1uVG9f7Cumr2XCqQ` |
| `MEMBERS_SHEET_RANGE` | `TBC Memberships!A:C` |
| `HIVE_FORM_ID`        | `1r_lj8nvUjM9avrTvlrb9Zd_V0WldP7eUOdUiSH01Jac` |

Sheet IDs are not secrets and live in version control. Only the Google
service account credentials are Worker secrets.

### Cloudflare account / zone / app IDs

| What | ID |
|------|----|
| Cloudflare Account | `7679249973b3ca7cd658c198c69e1e5e` |
| Zone: `torontobeekeeping.ca` | `875a91dd2ee58d534459eafaa3b49336` |
| Zone: `tbchivecheck.ca` | `6483c778b21c665836110a7c9c173aec` |
| Google Service Account | `tbc-sheets-reader@tbc-website-491722.iam.gserviceaccount.com` |
| CF Access App (TBC Members Area) | `40f844bc-ff6b-4669-9ec7-22b4a52cf825` |
| → email allow policy | `d4a7448f-d652-4b66-b8da-a687077ab066` |
| → service-token policy | `3978a8b4-b6ac-492c-9139-c8abf0ea4337` |
| CF Access service token (opencode-dev) | `0fac5f0c-1094-4a1f-a2bb-8dd7eeef1e14` |
| → client_id | `2e5b134fc2029cdb755476ee143f6c9e.access` (expires 2027-05-03) |

### Environment variables (local dev)

| Var | Used for |
|-----|----------|
| `HIVE_WORKER_URL` | Optional. Astro pages prepend this to `/api/...`. Empty in production. Set for local dev pointing at a remote Worker. |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | Service token for curl scripts that need to bypass Access. |
| `CLOUDFLARE_API_TOKEN` | For ad-hoc Cloudflare API calls. Needs Workers Scripts/Routes Edit, Pages Edit, Account Settings Read, Zone DNS Edit/Zone Read, Access Apps & Policies Edit. |

## Deployment

Every push to `main` triggers CI:

- `.github/workflows/deploy-pages.yml`: rebuilds Astro and pushes to
  Cloudflare Pages. Skipped if only `worker/**` changed.
- `.github/workflows/deploy-worker.yml`: runs `wrangler deploy`. Skipped
  unless `worker/**` changed. Sets Google secrets on each deploy.
- `.github/workflows/sync-access-policy.yml`: nightly at 05:00 UTC.
  Fetches `/api/members` with the service token, diffs the email list
  against the current Access policy, and PUTs an update if they differ.
  Refuses to push an empty list.

The Pages project is `tbc-website`, custom domain `torontobeekeeping.ca`,
build command `npm run build`, no build-time env vars needed (Astro uses
relative `/api/...` paths).

The Worker is `tbc-sheets-worker`, mounted at `torontobeekeeping.ca/api/*`
as a zone route. `*.workers.dev` is disabled in `wrangler.toml` so the
Access policy can't be sidestepped.

## DNS

`torontobeekeeping.ca`: Cloudflare zone. Records as needed for Pages and
the Worker route. No subdomains.

`tbchivecheck.ca`: registered at Hover, nameservers at Cloudflare
(`rayne.ns.cloudflare.com`, `woz.ns.cloudflare.com`). Single
`CNAME @ → tbc-website-btd.pages.dev` (proxied) so Cloudflare will
TLS-terminate, but a Single Redirect rule fires before the request
reaches Pages.

### tbchivecheck.ca redirect rule

A Cloudflare Single Redirect on the `tbchivecheck.ca` zone 301s every
request to `https://torontobeekeeping.ca/members/hive-check`. Path and
query string are dropped.

- Phase: `http_request_dynamic_redirect`
- Ruleset id: `858a366e1fec401b98641209a0cf10e4`
- Rule id: `936c6a9963474e8c9b2e0a815987e0ea`
- Expression: `(http.host eq "tbchivecheck.ca")`
- Target: static `https://torontobeekeeping.ca/members/hive-check`, 301, `preserve_query_string: false`

Manage via Cloudflare dashboard → `tbchivecheck.ca` → Rules → Redirect
Rules, or via API:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/6483c778b21c665836110a7c9c173aec/rulesets/858a366e1fec401b98641209a0cf10e4" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | python3 -m json.tool
```

The redirect funnels all `tbchivecheck.ca` traffic onto the main zone
where the Worker is also mounted, so every browser fetch stays
first-party. Don't change the target to a different registrable domain
without thinking about that.

## Local development

The recommended path is Docker Compose. The host doesn't need a
specific Node version because everything runs in containers. Three
compose profiles, pick one:

| Profile | What runs | When to use |
|---|---|---|
| `mock` | Astro + an in-memory mock API | Default for everyday dev. No credentials needed. |
| `live` | Astro only, pointed at production API | Visual / layout work where you don't need API responses. |
| `full` | Astro + real Worker via wrangler dev | When you need to test Worker changes against real Google Sheets. Requires Google service-account credentials. |

To tear down a running profile, pass the same `--profile` flag to
`down`. A bare `docker compose down` only sees unprofiled services
(none in our setup) and looks like a no-op:

```bash
docker compose --profile mock down    # or live / full
```

### Mock profile (recommended)

```bash
docker compose --profile mock up
```

Two containers:
- **astro-mock** on `http://localhost:4321` — the Astro dev server with a
  Vite proxy that forwards `/api/*` and `/cdn-cgi/access/*` to the mock.
- **mock** on `http://localhost:8788` — a tiny Node server
  (`mocks/server.mjs`) that implements the four API endpoints plus the
  Cloudflare Access identity endpoint. Seed data is in `mocks/*.json`.

Submissions append to in-memory state, so a hive check you submit
through the form shows up on the Hive Data page immediately. No 1-hour
cache, no auth.

The identity-endpoint mock returns an email for the "Submitting as
<email>" banner on the hive-check form. Lookup order:

1. `MOCK_IDENTITY_EMAIL` env var, if set (`MOCK_IDENTITY_EMAIL=you@example.com docker compose --profile mock up`)
2. `user.email` from the repo's `.git/config` (mounted read-only)
3. `user.email` from `~/.gitconfig` (mounted read-only)
4. `dev@example.test` as a final fallback

So if you have `git config user.email` set anywhere on the host, the
mock will pick it up automatically. The mock prints which source it
used on startup.

Edits to seed data: change the JSON files in `mocks/` and restart the
mock container. Edits to mock logic: change `mocks/server.mjs` and
restart.

### Live profile

```bash
docker compose --profile live up
```

Same Astro dev server, but pages fetch from
`https://torontobeekeeping.ca/api/*` directly (no proxy). Those are
Cloudflare Access protected, so the members-area JS will see 302s
in the console unless you separately authenticate to Access in the
same browser. Fine for working on layout, public pages, and most JS
that doesn't depend on API responses.

For a production build smoke test:

```bash
docker compose --profile live exec astro-live npm run build
```

Generates `dist/` inside the container.

### Full profile

```bash
docker compose --profile full up
```

Astro on :4321, wrangler dev on :8787. Needs these vars in `.env`:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (the full multi-line PEM, kept multi-line — `entrypoint.sh` collapses it)
- `HIVE_SHEET_ID`, `HIVE_SHEET_RANGE`, `MEMBERS_SHEET_ID`, `MEMBERS_SHEET_RANGE`, `HIVE_FORM_ID` (or accept the defaults from `worker/wrangler.toml`)

Without those, the worker container starts but every request fails when
it tries to mint a JWT.

Worker container gotchas (only matter if you're touching
`worker/Dockerfile` or `entrypoint.sh`):

- Must be `node:22-slim` (Debian). Alpine's musl libc breaks wrangler's `workerd`.
- Needs `ca-certificates` because `workerd` does its own TLS.
- No volume mount. A mount would shadow wrangler's downloaded `workerd`.
- `entrypoint.sh` writes `.dev.vars` from env, collapsing `GOOGLE_PRIVATE_KEY` to one line with literal `\n` via `awk`.
- Use `--ip 0.0.0.0` for `wrangler dev`. Don't pass `--local` (deprecated in v3).

### Without Docker

Requires Node 22+ on the host. If the host has Node 18 (common on stock
Debian/Ubuntu), use Docker.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # production build → dist/
```

For the mock setup without Docker, run `node mocks/server.mjs` in one
terminal and `MOCK_API_URL=http://localhost:8788 HIVE_WORKER_URL= npm
run dev` in another.

## Gotchas

- **Date format from Google Sheets**: dates arrive as `DD/MM/YYYY`. Use
  the `parseDate()` helper in `hive-data.astro`. `new Date()` won't
  parse this format.
- **Member email is never exposed to the browser** from hive data. The
  Worker drops the `Email address` column before returning.
- **Hive check form is rendered from live Google Form structure**:
  `hive-check.astro` fetches `/api/hive-form` at runtime and builds the
  form in JS. Adding a question to the Form makes it appear on the
  website within an hour. File-upload questions are filtered out.
- **The member's email is read from `/cdn-cgi/access/get-identity`**, a
  Cloudflare endpoint on any Access-protected domain. `CF_Authorization`
  is HttpOnly, so JS can't read it directly.
- **Astro `<style>` blocks are scoped by default.** Dynamically created
  DOM elements never get the scope attribute. Use `<style is:global>`
  for any CSS that targets JS-created elements.
- **Astro external CSS + SVG filter IDs**: `filter: url('#id')` in an
  external stylesheet can resolve the fragment against the CSS file's
  URL, not the document. Set SVG filter refs via `element.style.filter`
  in JS instead. Inline styles always resolve against `document.baseURI`.
- **SVG `display:none` hides filter/defs.** Use
  `position:absolute; width:0; height:0; overflow:hidden` instead.
- **Uniform clip-path borders need a parent filter.** Two stacked
  `clip-path: polygon()` layers with different heights produce uneven
  borders because the diagonal slopes differ. Apply an
  `feMorphology operator="dilate"` SVG filter on a parent element. CSS
  applies `filter` before `clip-path` on the same element, so the filter
  must not be on the clipped element itself.
- **Worker timestamps are UTC.** `new Date()` in the Worker doesn't know
  Toronto's timezone. Submissions via the custom form are offset 4-5
  hours from real Google Form submissions in the sheet. Fix with
  `Intl.DateTimeFormat` and `timeZone: 'America/Toronto'`.
- **`alert()` on form submission failure** in `hive-check.astro` is
  ugly. Should be an inline error state under the submit button.
- **No custom 404 page.** Astro's default 404 doesn't match the site's
  look. Add `src/pages/404.astro`.
- **The public Google Form URL still works.** Anyone with the old link
  can submit directly to the sheet, bypassing the website form and its
  Access gate. Either close the Form in the Forms UI or generate a new
  one and update `HIVE_FORM_ID`.

## Accessing protected URLs from the CLI

Use the `opencode-dev` service token:

```bash
source .env  # loads CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET

curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://torontobeekeeping.ca/api/hive-data
```

This works on both `/members/*` (the static pages) and `/api/*` (the
Worker) because both are gated by the same Access app, which has both
identity-based (email) and non-identity (service token) policies.

## Git

The repo uses the `JontiH` GitHub account with `~/.ssh/JontiH` as the
SSH key, configured as a local git override rather than the global
identity. Check with `git config --local --list`. Pushes need:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/JontiH -o IdentitiesOnly=yes" git push
```
