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

GitHub Pages is configured in `.github/workflows/deploy.yml` to build and deploy
`dist/` on pushes to `main`, using Node 24. It can also be run manually from
GitHub Actions. No separate deployment token is required.

Target URL: <https://fiddyfiddy.arons0n.com>.

One-time setup, matching Dailybreak:

1. In `joeyaronson/fiddyfiddy` → Settings → Pages, set the publishing source to **GitHub Actions**.
2. Set the Pages custom domain to **fiddyfiddy.arons0n.com** and save it before adding the DNS record.
3. In Squarespace DNS, add a **CNAME** with host **fiddyfiddy** and data **joeyaronson.github.io**. Keep the existing `@`, `www`, and `dailybreak` records.
4. Push the project to `main` and check the **Deploy GitHub Pages** workflow in the Actions tab.
5. Once the certificate is ready, enable **Enforce HTTPS** in Pages settings.

Vite's default base `/` is correct for this custom domain. A repository-path URL
such as `joeyaronson.github.io/fiddyfiddy/` would need a different base. Custom
domains for Actions deployments are configured in Pages settings; no `CNAME`
file is needed.

`.env.production` sets `SITE_URL` to the custom domain for absolute share image
URLs, the canonical URL, and `og:url`. Override it in `.env.production.local` or
the build environment if the domain changes. See `.env.example`.

The game is static and needs no server or SPA routing fallback. Cloudflare is
no longer used by the build or deployment workflow. After the custom domain is
working, the old Cloudflare Worker and any Workers Builds integration can be
removed in Cloudflare. Browser saves on the old `workers.dev` origin do not
transfer to the new domain.

References: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## Visit counts

Visit counts use the hosted GoatCounter service. Sign up at
<https://www.goatcounter.com/signup>, then set the public site address in
`.env.production`:

```dotenv
GOATCOUNTER_URL=https://YOURCODE.goatcounter.com
```

The `/count` endpoint from the tracking snippet also works. Rebuild and deploy
when changing this setting. Without it, no analytics script is included.
Tracking is included only in production builds, so `npm run dev` sends no visits.
GoatCounter ignores localhost by default; production previews on a public host
can count visits. No custom game events are sent.

For separate Dailybreak counts, add another site under GoatCounter Settings →
sites and use its tracking address there. Both sites stay static, with no
analytics server or npm dependency.

To verify collection, visit the deployed site and check the GoatCounter dashboard.
Ad blockers or network filtering may block `gc.zgo.at` or your GoatCounter
subdomain, preventing those visits from being counted.

Reference: [GoatCounter setup](https://www.goatcounter.com/help/start).
