# Contributing to Etsy Niche Research

Thanks for your interest in contributing! This is a small, focused open-source
tool and contributions of all sizes are welcome — bug reports, docs, and code.

## Ground rules

- Be respectful. See the [Code of Conduct](CODE_OF_CONDUCT.md).
- This tool only uses **public** Etsy data via the official Open API. Please do
  not add scraping, ToS-violating behavior, or anything that pulls private data.
- Keep the "favorites, not sales" honesty: the API does not expose units sold,
  so don't present favorites (or any estimate) as verified sales.

## Development setup

```bash
git clone https://github.com/Daniel-Alamezie/Etsy-Market-Research.git
cd Etsy-Market-Research
npm install
cp .env.example .env.local   # then add your Etsy API keys (optional)
npm run dev
```

The app runs on http://localhost:3001. Without API keys it runs on realistic
**sample data**, so you can develop the UI without credentials.

## Before opening a pull request

Run the full check suite locally — all must pass:

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # next build
```

- Add or update tests for any logic change (`lib/*.test.ts`).
- Keep changes focused; one concern per PR.
- Match the existing code style (TypeScript, no new dependencies unless needed).
- Never commit secrets. `.env.local` is git-ignored; keep real keys out of
  `.env.example` and out of code.

## Project layout

```
app/            Next.js App Router UI + API routes
  api/etsy/     server-side proxy to Etsy (keeps the secret server-only)
  components/   custom UI components (Dropdown, …)
lib/            pure logic: analysis, fx, format, mock, types (+ *.test.ts)
```

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what happened.
If it's a data issue, include the search keyword and whether you were on live
or sample data.
