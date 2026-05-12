# Setup

One-time steps to deploy the site from scratch. The site and the Worker
deploy separately. For ongoing operational detail see
[AGENTS.md](AGENTS.md).

## Prerequisites

- Cloudflare account (free tier is fine)
- Google account with access to the TBC Google Sheets
- Node.js 22+
- `wrangler` CLI: `npm install -g wrangler`

## 1. Google service account

This is how the Worker reads the Sheets without exposing them publicly.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project (e.g. "TBC Website").
2. Enable **Google Sheets API** and **Google Forms API** under APIs &
   Services → Library.
3. Create a service account: APIs & Services → Credentials → Create
   Credentials → Service Account. Name it `tbc-sheets-reader`. Role can
   be left blank.
4. Open the account → Keys → Add Key → Create new key → JSON. Download
   and keep it safe. Don't commit it.
5. From the JSON you need `client_email` and `private_key`.

Share both Sheets (hive notes, members list) with the service-account
email as Viewer. Uncheck "Notify people".

Sheet IDs are in the URL: `docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.

## 2. Deploy the Worker

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

The Worker is mounted at `torontobeekeeping.ca/api/*` via a zone route
(same origin as the site). `*.workers.dev` is off so the Access policy
can't be sidestepped.

Set the two Google secrets:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# paste client_email from the JSON

npx wrangler secret put GOOGLE_PRIVATE_KEY
# paste private_key from the JSON (include the BEGIN/END lines)
```

Sheet IDs and ranges live in `wrangler.toml` under `[vars]`, not as
secrets. Edit there if you need to change them.

To smoke-test the deployed Worker, use the service token (IDs in
AGENTS.md):

```bash
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://torontobeekeeping.ca/api/hive-data
```

## 3. Deploy the site (Cloudflare Pages)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Pages → Create a project → connect to GitHub
   → select `tbc_website`.
3. Build settings:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
4. No build-time env vars needed. The pages call `/api/...` relative
   to the site origin.
5. Deploy.

Push to `main` re-deploys automatically after this.

For the custom domain: Pages project → Custom domains → add
`torontobeekeeping.ca`. Cloudflare handles the DNS if the domain is on
the same account.

## 4. Cloudflare Access for the members area

This gates `/members/*` and `/api/*`.

1. [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → create
   a Zero Trust organisation. Pick any team name (e.g. `tbc`).
2. Settings → Authentication → add a One-Time PIN login method.
3. Access → Applications → Add → Self-hosted.
4. Application settings:
   - Name: TBC Members Area
   - Domains: add both `torontobeekeeping.ca/members` and
     `torontobeekeeping.ca/api`
   - Session duration: 24 hours
5. Policy:
   - Name: Members
   - Action: Allow
   - Include: Emails → paste the member email list

For ongoing maintenance, `sync-access-policy.yml` re-syncs this list
from the members Sheet every night.

## 5. Local dev

The recommended path is Docker Compose, because Astro 6 needs Node 22+
which many host machines don't have:

```bash
docker compose up astro
```

This starts the Astro dev server at `http://localhost:4321` and points
its `/api/*` calls at the live deployed Worker. Members pages will
render but their API calls hit Cloudflare Access; for that to work you
need an active Access session in the same browser (or accept that
those calls fail in dev).

To run the Worker locally too, populate `.env` with the Google
service-account credentials and the sheet IDs, then:

```bash
HIVE_WORKER_URL_OVERRIDE=http://localhost:8787 \
  docker compose --profile full up
```

See [AGENTS.md](AGENTS.md#local-development) for the full var list and
gotchas.

If you have Node 22+ on the host and don't want Docker:

```bash
npm install
cp .env.example .env
npm run dev    # http://localhost:4321
```

## Cache bust

The Worker caches Sheets responses for 1 hour. Force a refresh by
bumping `CACHE_VER` in `worker/wrangler.toml` and pushing.
