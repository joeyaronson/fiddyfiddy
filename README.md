# fiddyfiddy

Mobile-first daily area-splitting game using React, TypeScript, Vite, and Three.js.
Five seeded shapes per UTC day, with one submitted cut per level, animated area
measurements, and shareable results.

## Development

Use Node 24 (`nvm use` if you use nvm), then:

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Daily puzzles

`src/lib/daily.ts` provides a UTC date, versioned puzzle ID, and seeded random generator. Start each puzzle generation with `createSeededRandom(getPuzzleId(date))`. Identical seeds and identical calls produce identical values. Avoid `Math.random()` in puzzle generation.

Keep generation code and input data stable within a version. Bump the version when either changes; plan releases at a daily boundary to avoid changing an active day's puzzle.

`useDailyPuzzle` observes UTC midnight and tab focus. The active game keeps its
original date until it is finished. After midnight, the results screen offers
the new day's set. An unfinished saved set also resumes across a browser restart.

Progress is saved in localStorage under `fiddyfiddy:day:YYYY-MM-DD`; the
`fiddyfiddy:active-date` pointer identifies an unfinished set. Records store the
generator ID, exact shape controls, submitted cuts, and current level. Scores
are derived from the saved cuts. Completed days reopen at results. Submitted
cuts remain locked, including across tabs. Invalid records are ignored; storage
failures leave the game playable and display a save notice.

The difficulty review is recorded in [docs/difficulty-review.md](docs/difficulty-review.md).

Dates use the device clock. Client-side answers and future puzzles can be inspected, and local results can be edited.

## Hosting

The split-polygon favicon and home-screen icon are in `public/`. The social
preview is `public/share-card.png` (1200 × 630), with an editable SVG alongside it.
Open Graph and large-image card metadata are included in the HTML.

When a public domain is chosen, set `SITE_URL` in `.env.local` or the hosting
build environment, then rebuild. See `.env.example`. This sets absolute share
image URLs, the canonical URL, and `og:url`. Without it, local development uses
the relative image path and does not invent a public domain.

Build output is `dist/`. `wrangler.jsonc` configures Cloudflare Workers Static Assets with SPA fallback. No Worker handler is required.

With Node 24, install the deployment CLI when ready:

```sh
npm install -D wrangler
npm run build
npx wrangler deploy
```

For automatic deployment, connect the repository to Cloudflare Workers Builds with Node 24, build command `npm run build`, and deploy command `npx wrangler deploy` after adding Wrangler. Hosting has not been provisioned or deployed.
