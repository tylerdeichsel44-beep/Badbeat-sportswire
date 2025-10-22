# Badbeat Sportswire v7 — all-in-one

**Includes:** live scores, local timezone, league pages, team pages (logos + player headshots), standings, UFC/Boxing, NFL/NBA logo auto-capture, and NFL/NBA **headshot prefill** from official roster pages.

## Build locally
```bash
npm ci
npm run prefill   # optional but recommended (fills data/assets-map.json with same-origin headshots)
npm run full      # fetch + build -> public/
npx serve public  # preview locally
```

## Deploy to Vercel
- Framework Preset: Other
- Install Command: `npm ci`
- Build Command:   `npm run full`
- Output Directory: `public`

## Notes
- No external deps. Requires **Node 18+** for global `fetch()`.
- If some teams’ headshots don’t appear, open `data/assets-map.json` and paste a direct, publicly available URL from the team site for that player.
