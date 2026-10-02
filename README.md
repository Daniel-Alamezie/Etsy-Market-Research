# Etsy Niche Research

[![CI](https://github.com/Daniel-Alamezie/Etsy-Market-Research/actions/workflows/ci.yml/badge.svg)](https://github.com/Daniel-Alamezie/Etsy-Market-Research/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)

A market-research tool for Etsy sellers. Search a print (or any) niche and get
real, analyzable signal from Etsy's **public** listing data — **price
distribution, competitor tags, favorites, and listing freshness** — so you can
judge pricing and competition before committing to a niche.

Built with Next.js (App Router) on the official **Etsy Open API v3**. Your API
secret stays **server-side only** and never reaches the browser.

> ℹ️ **Favorites, not sales.** Etsy's API deliberately does **not** expose units
> sold or a "best sellers" ranking. This tool uses **favorites** as a demand
> proxy and is honest about it. For sales estimates, pair it with a tool like
> EverBee.

---

## Features

- 🔎 **Niche search** with price range, sort, and result-count controls
- 💰 **Price intelligence** — median, average, min/max, and a distribution histogram
- 🏷️ **Competitor tag frequency** — the keywords other sellers rank for (your SEO shortlist)
- ❤️ **Favorites** as a demand proxy (avg + top listing)
- 📅 **Listing freshness** — how much of the niche was created recently
- 💱 **Currency toggle** (USD / GBP / EUR) with live FX conversion — also normalizes mixed-currency results
- 🧾 **Clean, numbered results table** with de-cluttered titles + CSV export
- 🧪 **Sample-data mode** so the whole UI works before your API key is approved

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- Etsy Open API v3 (public listing data)
- [Vitest](https://vitest.dev) for unit tests
- No UI framework — hand-written, theme-aware CSS (light/dark)

---

## Quick start

```bash
git clone https://github.com/Daniel-Alamezie/Etsy-Market-Research.git
cd Etsy-Market-Research
npm install
cp .env.example .env.local     # add your keys (optional — see below)
npm run dev
```

Open **http://localhost:3001**. Without keys, it runs on realistic sample data.

### Get Etsy API keys (optional, for live data)

1. Enable two-factor auth on your Etsy account.
2. Go to <https://www.etsy.com/developers> → **Create a New App**.
3. Use a clear description (e.g. *"personal read-only market-research tool"*).
4. Copy the **Keystring** and **Shared Secret** into `.env.local`.
5. A **Personal App** review can take ~24–48h. Until it's approved, the app
   automatically shows sample data (badge reads "Sample data" → flips to "Live
   data" once the key activates).

Every request sends `x-api-key: KEYSTRING:SHARED_SECRET`, which is why the secret
is kept server-side and proxied through `app/api/etsy/`.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ETSY_KEYSTRING` | for live data | Your app's keystring (public part of the key). |
| `ETSY_SHARED_SECRET` | for live data | Your app's shared secret. **Server-side only.** |
| `ETSY_FORCE_MOCK` | no | Set to `true` to always use sample data (demo mode). |

`.env.local` is git-ignored. **Never** put real keys in `.env.example` or in code.

---

## What it can and can't tell you

| ✅ Available | ❌ Not available |
|---|---|
| Prices → min / max / median / distribution | Actual units sold |
| Tags competitors rank for (frequency) | A "top sellers" ranking |
| Favorites per listing (**demand proxy**) | Verified revenue |
| Listing age / created dates (freshness) | Conversion rates |
| Listing counts (saturation signal) | Traffic / views |

---

## Scripts

```bash
npm run dev         # start the dev server (http://localhost:3001)
npm run build       # production build
npm start           # run the production build
npm run typecheck   # tsc --noEmit
npm test            # run the Vitest suite
npm run test:watch  # tests in watch mode
```

## Testing

Unit tests cover the pure logic (analysis, FX conversion, formatting/title
cleanup, and the mock generator):

```bash
npm test
```

## Deployment (Vercel)

This is a standard Next.js app and deploys cleanly to [Vercel](https://vercel.com):

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the repo.
3. Add environment variables `ETSY_KEYSTRING` and `ETSY_SHARED_SECRET`
   (Production + Preview).
4. Deploy. The default build/output settings work out of the box.

It also runs on any Node host that supports Next.js (`npm run build && npm start`).

---

## Project structure

```
app/
  page.tsx                 # dashboard UI (client)
  layout.tsx
  globals.css              # theme-aware styling
  components/Dropdown.tsx   # on-brand custom select
  api/etsy/
    search/route.ts        # server proxy → Etsy, normalizes to USD, falls back to mock
    status/route.ts        # probes whether the key is active yet
lib/
  etsy.ts                  # Etsy client (keeps secret server-side)
  analysis.ts              # price/tag/favorites/date analysis
  fx.ts                    # FX rates + USD normalization
  format.ts                # money/date formatters, title cleanup, entity decode
  mock.ts                  # deterministic sample data
  types.ts
  *.test.ts                # Vitest unit tests
```

## Rate limits

The free Etsy tier allows ~5 QPS and 5,000 requests/day — far more than this tool
needs. Each "Analyze" pulls up to 300 listings (a few API calls).

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2026 Daniel Alamezie

---

*Not affiliated with Etsy. "Etsy" is a trademark of Etsy, Inc. This tool reads
public listing data only and does not sign in as a seller or access private data.*

## Optional shop sales history

Set `APIFY_TOKEN` to append a **30d sales / trend** column from the hosted
`publicrecords/etsy-shop-velocity` panel (no scraping on your side). Off without
the token. Shops without history return `no_coverage` free and are queued for
the next day. Requires `apify-client`.
