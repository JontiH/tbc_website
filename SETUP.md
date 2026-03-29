# TBC Website — Setup Guide

This guide covers the one-time setup steps required to fully deploy the site.
The Astro site (Cloudflare Pages) and the Cloudflare Worker are deployed separately.

---

## Prerequisites

- A Cloudflare account (free tier is sufficient)
- A Google account with access to the TBC Google Sheets
- Node.js v22+ installed locally
- `wrangler` CLI: `npm install -g wrangler`

---

## 1. Google Cloud — Service Account Setup

This gives the Worker read-only access to the Google Sheets without exposing them publicly.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "TBC Website")
3. Enable the **Google Sheets API**:
   - Navigation menu → APIs & Services → Library → search "Google Sheets API" → Enable
4. Create a Service Account:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Name: `tbc-sheets-reader` (or anything)
   - Role: not required — leave blank, click Done
5. Open the service account → Keys tab → Add Key → Create new key → JSON
6. Download the JSON key file — keep this safe, never commit it

From the downloaded JSON, you will need:
- `client_email` → this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key`  → this is your `GOOGLE_PRIVATE_KEY`

### Share the sheets with the service account

In each Google Sheet (hive notes and members list):
1. Click Share
2. Paste the service account email (`tbc-sheets-reader@YOUR_PROJECT.iam.gserviceaccount.com`)
3. Set permission to **Viewer**
4. Uncheck "Notify people"
5. Click Share

### Get the Sheet IDs

The Sheet ID is in the URL:
`https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

Copy the `SHEET_ID_HERE` part for both sheets.

---

## 2. Cloudflare Worker — Deploy

The Worker lives in `worker/` and is deployed independently of the Astro site.

```bash
cd worker
npx wrangler login      # authenticate with Cloudflare
npx wrangler deploy     # deploy the worker
```

Note the Worker URL — it will be something like:
`https://tbc-sheets-worker.YOUR_SUBDOMAIN.workers.dev`

### Set Worker Secrets

Run each of these and paste the value when prompted:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# paste: client_email from the JSON key file

npx wrangler secret put GOOGLE_PRIVATE_KEY
# paste: private_key from the JSON key file (include the full -----BEGIN/END----- lines)

npx wrangler secret put HIVE_SHEET_ID
# paste: the Sheet ID of the hive notes Google Sheet

npx wrangler secret put HIVE_SHEET_RANGE
# paste: Sheet1!A:L  (adjust tab name if different)

npx wrangler secret put MEMBERS_SHEET_ID
# paste: the Sheet ID of the members list Google Sheet

npx wrangler secret put MEMBERS_SHEET_RANGE
# paste: Sheet1!A:Z  (adjust tab name and column range to match your sheet)
```

Test the Worker:
```
https://tbc-sheets-worker.YOUR_SUBDOMAIN.workers.dev/hive-data
https://tbc-sheets-worker.YOUR_SUBDOMAIN.workers.dev/members
```

---

## 3. Cloudflare Pages — Deploy the Astro Site

### First deploy

1. Push this repo to GitHub (under the JontiH account)
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Pages → Create a project
3. Connect to GitHub → select the `tbc_website` repo
4. Build settings:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Add environment variable:
   - `HIVE_WORKER_URL` = `https://tbc-sheets-worker.YOUR_SUBDOMAIN.workers.dev`
6. Click Deploy

### Subsequent deploys

Pushing to `main` triggers an automatic rebuild and deploy.

### Custom domain

Once the site is live on `*.pages.dev`:
1. Pages project → Custom domains → Add a custom domain
2. Enter `torontobeekeeping.ca`
3. Cloudflare will guide you through updating DNS (or it's automatic if the domain is already on Cloudflare)

---

## 4. Cloudflare Access — Members Area Auth

This protects `/members/*` so only approved email addresses can access it.

### Enable Zero Trust

1. Go to [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. Create a Zero Trust organisation (free) — choose a team name (e.g. `tbc`)

### Add One-Time PIN identity provider

1. Zero Trust dashboard → Settings → Authentication
2. Under "Login methods" → Add new → One-time PIN
3. Save

### Create an Access Application

1. Zero Trust → Access → Applications → Add an application
2. Choose **Self-hosted**
3. Settings:
   - **Application name**: TBC Members Area
   - **Application domain**: `YOUR_PAGES_SUBDOMAIN.pages.dev/members*`
     (or `torontobeekeeping.ca/members*` once the domain is live)
   - **Session duration**: 24 hours (or longer — members shouldn't have to log in often)
4. Next → Create a policy:
   - **Policy name**: Members
   - **Action**: Allow
   - **Include rule**: Emails → paste all ~50 member email addresses (one per line)
5. Save

### Managing the email list

When members join or leave:
1. Zero Trust → Access → Applications → TBC Members Area → Edit
2. Edit the policy → update the email list
3. Save

Members will receive an email OTP when they visit `/members` for the first time (or after their session expires). They enter the 6-digit code and are in. Sessions persist so they won't need to do it frequently.

---

## 5. Members List Page

The `/members/members-list` page is currently stubbed. Once you share the column headers from the members list Google Sheet:

1. The Worker already has the `/members` endpoint wired up — it returns all columns as-is
2. The frontend automatically renders whatever columns the sheet contains
3. No code changes needed — just ensure `MEMBERS_SHEET_ID` and `MEMBERS_SHEET_RANGE` secrets are set

---

## 6. Logo

Place your logo file at `public/logo.png` (or update the `src` in `src/components/Nav.astro` if using a different filename/format). The nav and any other references will pick it up automatically.

---

## 7. Local Development

```bash
# Install dependencies (requires Node 22+)
npm install

# Copy env example and fill in your Worker URL
cp .env.example .env

# Start dev server
npm run dev
```

The site runs at `http://localhost:4321`. The members area will attempt to fetch from the Worker URL in your `.env` file. If the Worker isn't deployed yet, those pages will show a loading error — that's expected.

---

## Worker Cache

The Worker caches Google Sheets responses for 1 hour using Cloudflare's Cache API. To force a refresh (e.g. after a data update):

- Option A: Wait for the cache to expire (1 hour)
- Option B: Deploy a new version of the Worker (`npx wrangler deploy`) — this busts the cache
- Option C: In the future, add a `?bust=1` query param handler to the Worker
