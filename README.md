# Badbeat Sportswire

**Hybrid scoreboard + neutral news static site** — production-ready.

- Static build served from `public/`
- Hourly refresh via GitHub Actions
- ESPN scoreboard as primary data (undocumented; may change); polite rate-limited fetching
- Optional Google fallback parser (stub)
- Ad slots ready (placeholders for AdSense/affiliates)
- Vercel JSON included for turnkey deploy

## Quick start
```bash
npm ci
npm run full
# preview locally
npx serve public
```

## Deploy to Vercel
- Build Command: `npm run full`
- Output Directory: `public`
- Optionally connect GitHub repo for auto-deploy on hourly commits.

## GitHub Actions (hourly)
`.github/workflows/cron-build.yml` triggers hourly: runs `npm run generate && npm run build`, commits `public/`.

## Responsible Gambling
All content is informational. Not betting advice. Age-gate and regional compliance are your responsibility.
