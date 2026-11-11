# PATA — Two-Player Number Hunt

A live, turn-based two-player game. One hundred numbers are shuffled into a
10×10 grid. The chooser picks a target number; the opponent has to find and
click it as fast as possible. **Every microsecond the finder takes is awarded
to the chooser.** Roles swap each turn. After the agreed number of turns, the
player with the most points wins.

PATA is a mobile-first PWA: installable, offline-aware, animated, and playable
in the browser with no app store.

## Rules

- Board: `1–100`, shuffled once per match, identical for both players.
- Turns per player: **5, 10, or 20** (2× total turns).
- Chooser clicks an unused number. The finder sees “Your opponent chose N” and
  must locate `N` in the grid.
- The server records the time between the choice and the correct click, in
  microseconds, and adds it to the chooser's score.
- Used numbers are locked on both boards.
- Highest total score wins. Ties are draws.
- Results are stored and feed the community leaderboard (wins, then points).

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) on Vercel
- **Tailwind CSS v4** with a hand-rolled animation system
- **Supabase** free tier — Postgres, anonymous auth, Realtime
- Server-authoritative timing with Postgres `clock_timestamp()` and atomic
  `plpgsql` functions
- PWA: web manifest, service worker, offline fallback, install prompt
- Web Audio SFX, vibration haptics, and a canvas confetti burst (no media
  assets or animation libraries)

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Authentication → Providers → Anonymous Sign-Ins** and enable it.
3. Open **SQL Editor → New query**, paste `supabase/schema.sql`, and run it.
   This creates tables, the leaderboard view, atomic game functions, RLS
   policies, and adds `matches` to the Realtime publication.

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret key (server only) |

> Never commit `.env.local` or expose the service-role key to the browser.

### 3. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, set a display name, create a match, and open the
invite link in a second browser profile (or send it to a friend).

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npx vercel login
npx vercel --prod
```

When prompted, link the project and add the three environment variables above
for **Production** (and **Preview** if you use previews).

### Option B — GitHub import

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project → Import** the repo.
3. Add the same three environment variables in **Project → Settings →
   Environment Variables**.
4. Deploy. Next.js is detected automatically; no build overrides are needed.

After the first deploy, open the production URL on a phone and use the install
prompt (Android/Chrome) or **Share → Add to Home Screen** (iOS/Safari).

## PWA notes

- `src/app/manifest.ts` generates `/manifest.webmanifest` with icons,
  shortcuts, and standalone display settings.
- `public/sw.js` caches the app shell, serves pages network-first with an
  offline fallback, and caches static assets cache-first. API requests are
  never cached.
- The service worker registers **only in production**, so use
  `npm run build && npm start` to test installability and offline mode.
- `/offline` is the fallback page when the network is unavailable.
- Icons are generated from one SVG definition:

```bash
npm run icons
```

This writes `public/icons/*`, `src/app/icon.png`, `src/app/apple-icon.png`,
`src/app/favicon.ico` (16/32/48/64) and the upload-ready brand files in
`public/brand/`. Re-run it after changing the icon artwork. The same mark is
rendered inline in the header by `src/components/LogoMark.tsx`, so update both
if the logo changes.

## How timing works

`select_number()` stores `target_since = clock_timestamp()` in Postgres.
`resolve_found()` computes:

```sql
elapsed = round(extract(epoch from (clock_timestamp() - target_since)) * 1000000)
```

so the authoritative clock is the database, not either browser. The winning
score is the sum of those microsecond values. The live timer in the UI is an
approximation for tension; the stored score is the server value.

## Game feel

- **Sound** — synthesized Web Audio cues for select, found, wrong, turn, and
  win. Mute from the header; the choice is stored in `localStorage`.
- **Haptics** — short vibration patterns on supported Android devices.
- **Reactions** — emoji broadcasts over Supabase Realtime, floating across the
  board.
- **Presence** — the match channel reports whether an opponent is connected.
- **Ranks and levels** — derived from leaderboard data (wins, draws, matches,
  points), so no extra schema is required.
- **Reduced motion** — every animation respects `prefers-reduced-motion`.

## Project layout

```
src/app/
  page.tsx                     lobby: hero, create/join, top players
  leaderboard/page.tsx         podium, rankings, rank ladder, recent results
  match/[code]/page.tsx        server wrapper
  match/[code]/MatchClient.tsx live match orchestration
  offline/page.tsx             offline fallback
  manifest.ts                  web app manifest
  api/matches/                 create, join, state, select, found
  api/leaderboard/             rankings
src/components/
  match/                       player cards, action panel, result, reactions
  NumberGrid, LiveTimer, LeaderboardTable, SiteHeader, HowToPlay,
  Confetti, AnimatedNumber, RankBadge, TurnPips, ScoreBar,
  InstallPrompt, ServiceWorkerRegister, SoundToggle
src/lib/
  game.ts                      formatting and turn constants
  gamification.ts              ranks, levels, progress
  sound.ts / haptics.ts        feedback helpers
  client/                      session + API helpers
  server/                      admin client and request auth
public/
  sw.js                        service worker
  icons/                       generated PWA icons + favicon
  brand/                       upload-ready logo PNGs (Product Hunt, stores)
supabase/schema.sql            database, functions, RLS, realtime
scripts/generate-icons.mjs     icon generation
scripts/shoot.mjs              launch screenshot capture (two browsers)
scripts/e2e.mjs                two-player API end-to-end test
launch/                        Product Hunt copy + gallery images
```

## Scripts

```bash
npm run dev     # development server (Turbopack)
npm run build   # production build + type check
npm run lint    # ESLint
npm start       # run the production build
npm run icons   # regenerate PWA icons
npm run shots   # capture the launch gallery (needs npm start on :3100)
npm run e2e     # two-player API test against BASE_URL (default :3100)
```

## Notes

- Anonymous sessions are stored in the browser. Clearing site data creates a
  new identity; linking email/password can be added later for persistent
  accounts.
- Writes are only possible through the server API using the service-role key.
  The browser can read its own match rows for Realtime updates because RLS
  grants `SELECT` to the two participants.
- If Realtime is unavailable, the match screen polls every 2.5 seconds, so the
  game still works.
