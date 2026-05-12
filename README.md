# Toronto Beekeepers Collective Website

The website for the Toronto Beekeepers Collective (TBC), a non-profit
urban beekeeping club in Toronto. Live at
**[torontobeekeeping.ca](https://torontobeekeeping.ca)**.

See [AGENTS.md](AGENTS.md) for deep technical detail and
[SETUP.md](SETUP.md) for first-time setup. This README is the high-level
overview.

## What it does

Public pages cover what TBC is, its history, the bee yards, and how to
join. A members-only section behind email login provides:

- A hive-data dashboard (visit calendar, mite-count chart, sortable
  table)
- A hive-check submission form
- The current member list

## Design choices

The site is fully static. Pages are pre-built HTML; nothing renders at
request time. The only dynamic content is in the members area, which
fetches live data from a small Cloudflare Worker after the page loads.

Data lives in Google Sheets and Google Forms. Hive visits, the member
list, and the hive-check form structure are all managed there. Updating
data does not require a code change or a redeploy. Edit the sheet, wait
up to an hour for the cache to roll over.

The site itself holds no Google credentials. Browsers talk to the
Worker, and only the Worker holds the service-account key.

Auth runs at the edge through Cloudflare Access. There are no login
forms or session-management code in the site. The allowed email list is
synced from the members Sheet to Cloudflare every night.

Everything sits on Cloudflare and Google free tiers. The only ongoing
cost is the domain registration.

## How it fits together

```mermaid
flowchart LR
    U["Member's browser"]
    SC["tbchivecheck.ca<br/>shortcut domain"]

    subgraph CF["Cloudflare edge"]
        direction TB
        ACC["Cloudflare Access<br/>email OTP login"]
        PAGES["Cloudflare Pages<br/>static Astro site<br/>torontobeekeeping.ca/*"]
        WORK["Cloudflare Worker<br/>torontobeekeeping.ca/api/*"]
        CACHE[("Edge cache<br/>1h TTL")]
        REDIR["Single Redirect rule"]
    end

    subgraph Google["Google"]
        direction TB
        SHEET["Sheets<br/>hive visits + members"]
        FORM["Form<br/>hive check structure"]
    end

    subgraph GH["GitHub"]
        direction TB
        REPO["JontiH/tbc_website"]
        CI["Actions<br/>auto-deploy + nightly sync"]
    end

    U -->|"public pages"| PAGES
    U -->|"members pages<br/>(after OTP)"| ACC
    ACC -->|"authorised"| PAGES
    U -->|"/api/* fetch<br/>(same-origin)"| ACC
    ACC -->|"authorised"| WORK
    WORK <-->|"cache hit:<br/>return instantly"| CACHE
    WORK -.->|"cache miss:<br/>read / append"| SHEET
    WORK -.->|"cache miss:<br/>read form structure"| FORM
    U -->|"shortcut URL"| SC
    SC -->|"301"| REDIR
    REDIR -->|"→ /members/hive-check"| PAGES

    REPO --> CI
    CI -->|"deploy"| PAGES
    CI -->|"deploy"| WORK
    CI -->|"nightly sync<br/>emails → allowlist"| ACC

    classDef user fill:#FDE9C0,stroke:#D4881A,color:#2B2B2B
    classDef cf fill:#fff,stroke:#F5A623,color:#2B2B2B
    classDef ext fill:#E8F5E9,stroke:#2E7D32,color:#2B2B2B
    classDef gh fill:#f4f4f4,stroke:#555,color:#2B2B2B
    class U,SC user
    class PAGES,WORK,ACC,REDIR,CACHE cf
    class SHEET,FORM ext
    class REPO,CI gh
```

## Request flow

**Public page.** Browser hits Cloudflare Pages, gets pre-built HTML, done.

**Members page.** Browser hits the page; Access checks for a login
cookie; first-time visitors get a six-digit code by email. After login,
Pages serves the HTML, the page's JS calls `/api/hive-data` (or
similar), the same Access cookie authorises the API request, and the
Worker pulls fresh data from Google Sheets, caches it for an hour, and
returns JSON.

**Hive check submission.** The page calls `/api/hive-form` to render the
questions from the live Google Form. The member fills it in and posts
the answers to `/api/hive-form-submit`. The Worker appends a row to the
hive sheet.

## Repository layout

```
tbc_website/
├── .github/workflows/        CI: auto-deploy, nightly member sync
├── src/
│   ├── pages/                One .astro file per route
│   │   ├── index.astro       Home
│   │   ├── about.astro
│   │   ├── membership.astro
│   │   └── members/          Members-only pages
│   ├── components/           Nav, Footer, MembersNav
│   ├── layouts/Base.astro    HTML shell shared by all pages
│   └── styles/global.css     Design system: colours, components
├── worker/                   The API: runs on Cloudflare's edge
│   ├── index.js              All four endpoints (~360 lines)
│   └── wrangler.toml         Deploy config
├── public/                   Static assets (favicon, logo, OG image)
├── AGENTS.md                 Deep technical reference
├── SETUP.md                  One-time setup instructions
└── README.md                 This file
```

## Tech

[Astro](https://astro.build) static site generator. Plain CSS, no
framework, no Tailwind. [Chart.js](https://www.chartjs.org/) loaded
from a CDN for the mite-count chart (lazy-loaded). Cloudflare Pages
for the site, Cloudflare Workers for the API, Cloudflare Access for
auth. Google Sheets API and Forms API for data. GitHub Actions for
CI/CD.

No databases, no servers, no Docker in production, no Node.js runtime
serving the site at request time.

## Running locally

```bash
# Node 22+
npm install
npm run dev          # http://localhost:4321
```

That gets you the static site locally. Calls to `/api/*` will fall back
to the deployed Worker if you set `HIVE_WORKER_URL` in a `.env` file
(see `.env.example`). To run the Worker locally too, use the Docker
Compose setup described in AGENTS.md.

## Editing content

| What | Where | How |
|---|---|---|
| Page copy (Home, About) | `src/pages/*.astro` | Code change, push to main |
| Design / colours | `src/styles/global.css` | Code change, push to main |
| Member list | Members Google Sheet | No code change, synced nightly |
| Hive visit data | Hive Notes Google Sheet (or submit via the form) | No code change, live within 1 hour |
| Hive check form questions | Linked Google Form | No code change, live within 1 hour |

## Who maintains it

The repo lives at
**[github.com/JontiH/tbc_website](https://github.com/JontiH/tbc_website)**.
For questions, [AGENTS.md](AGENTS.md) has architecture decisions,
gotchas, and operational details.
