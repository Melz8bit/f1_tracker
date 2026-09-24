# F1 Dashboard — Project Reference

This file is the persistent context for Claude Code. Read it at the start of every session.

## What this app is
A Formula 1 season dashboard web app that replaces the hand-maintained `f1_2026_dashboard.html` mockup
(the layout/content reference) with data pulled from APIs and calculated automatically.
Primary season: 2026. Past seasons supported where the APIs allow.
The Home page is a 6-tab dashboard, mirroring the mockup:
Standings / Pace Profiles / Race by Race / Reg Changes / Form Guide / Driver Contracts.
There is no Speed Trap tab (dropped 2026-09-23); straight-line speed lives inside Pace Profiles.

## Tech Stack
- React 19 + Vite + TypeScript
- Tailwind CSS v3
- Recharts v3 (charts)
- Zustand (global filter state)
- TanStack Query / React Query v5 (data fetching + caching)
- React Router v7
- Embla Carousel (mobile tab swiping)
- Primary API: OpenF1 — https://api.openf1.org/v1 (no key required)
- Fallback API: Jolpica — https://api.jolpi.ca/ergast/f1 (Ergast mirror, no key required; Ergast was decommissioned end of 2024)
- FIA decision documents (PDF) — https://www.fia.com/documents/championships/fia-formula-one-world-championship-14 (power unit usage + penalties, scraped by a script, never from the browser)
- Hosting: Vercel

## Design System
Matches `f1_2026_dashboard.html`. Its CSS is ported into `src/index.css` as component classes
(`.metric`, `.con-row`, `.title-pill`, `table.drv`, `.card`, `.tb` …) — reuse those before adding new styles.
- Background: #0f0f0f | Cards: #1a1a1a | Inset panels: #141414 | Borders: #2a2a2a / #1e1e1e
- Text: #e8e8e8 primary, #888 / #666 / #555 / #444 stepping down
- Pills: green (in the fight) · amber (unlikely) · red (eliminated)
- System sans-serif font, 13px body. Dark theme only.
- Flags are images from flagcdn.com (Windows can't render flag emoji)

## Team Colors
Defined once in `src/lib/teams.ts`, keyed by Jolpica constructorId (Racing Bulls = `rb`), using the
mockup's palette. Teammates share a colour; charts dash the second driver.

## Global Filter (Zustand — filterStore.ts)
{ season: number, roundMin: number, roundMax: number }
All dashboard tabs subscribe to this store. RangeFilter.tsx renders the UI (season dropdown +
round range slider). On mobile it collapses into a bottom sheet.

## Data Sources — what comes from where
Live in the browser (TanStack Query):
- Schedule, sprint flags, results, sprint results, qualifying, per-round standings → Jolpica
- Cancelled rounds → OpenF1 `sessions.is_cancelled` (Jolpica omits them)
- Current line-up → OpenF1 `/drivers` for the current/next meeting (useLineup). Applied only when viewing
  the latest round, because Jolpica only reflects a seat swap after a race result (e.g. Lawson back to
  Racing Bulls for Baku). Past rounds keep the team raced for. Team colours: mockup palette in teams.ts
- Race facts (SC/VSC, steward penalties, pit stops, tyre stints, overtakes, weather) → OpenF1
- Everything derived: title-eligibility pills, max points remaining (uses real sprint count), gaps,
  zone headers, constructor badges, "next race", numeric narrative sentences

Pre-computed by scripts in `scripts/` → committed JSON in `src/data/`:
- Pace ratings (OpenF1 laps + car_data), PU element usage + penalties (FIA PDFs)

Press summaries (decided 2026-09-23/24) — automatic via the Vercel function `/api/news`:
- Every page load calls `/api/news?season=…` (useRaceNews). The function returns all summaries and, if a
  finished race is due (race day + 2 days) and not yet summarized, scrapes + summarizes it in the
  background (waitUntil) and stores it in Vercel Blob (`race-news/<season>.json`, private). Each race is
  summarized once (~$0.08 on Sonnet 5); max 3 attempts, 10-min lock against duplicates.
- Vercel cron (vercel.json, Hobby = once/day per job, ±59 min): /api/news 09:00 UTC, /api/pace 07:00 UTC,
  /api/power-units 06:00 + 18:00 UTC — so summaries and FIA data land even if nobody visits. Same idempotent code paths as
  page loads (locks, once per race), so duplicate or missed cron runs are harmless.
- Only races after the newest one in `src/data/raceNews.json` are auto-generated (R15 onward for 2026);
  earlier races keep hand-written notes — never backfill.
- Sources: The Race, RacingNews365, GPFans, PlanetF1 (Crash.net: links only, it blocks AI crawlers).
  Every bullet links its sources; quotes verified verbatim; API data overrides any number in an article.
- Code: shared pipeline in scripts/news/pipeline.ts; function source server/news.ts, bundled to
  api/news.js by `npm run build:api` (part of `npm run build`) — commit the bundle after editing server/.
  Vercel env: ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN. `npm run dev` has no /api → falls back to the
  committed JSON. `npm run news -- --round N` regenerates one round locally (needs .env.local key).

Manual JSON in `src/data/` (no source exists):
- Driver contracts, ADUO status, regulation text, optional per-round editorial notes
- Every manual file carries `asOfRound`; the UI shows a "last reviewed Rn" badge when it lags the
  latest completed round

## Key API Endpoints
### OpenF1
GET /meetings?year=2026                       (meeting_name + is_cancelled → cancelled rows)
GET /sessions?year=2026                       (Jolpica round → session: race date inside meeting dates)
GET /drivers?session_key=...
GET /session_result?session_key=...
GET /championship_drivers?session_key=...     /championship_teams?session_key=...
GET /laps?session_key=...                     (one call, group client-side — per-driver calls hit 429)
GET /car_data?session_key=...&driver_number=...&date>=...&date<=...   (pace script only)
GET /location?session_key=...&driver_number=...&date>=...&date<=...   (pace script only)
GET /race_control  /pit  /stints  /overtakes  /weather  ?session_key=...

### Jolpica (Ergast mirror)
GET /2026.json                                (schedule; `Sprint` key marks sprint weekends)
GET /2026/driverStandings.json   /2026/constructorStandings.json
GET /2026/{round}/driverStandings.json        (standings as of an earlier round)
GET /2026/{round}/results.json   /2026/results.json
GET /2026/sprint.json   /2026/qualifying.json
Jolpica returns at most 100 rows per request whatever `limit` says — page with `offset`
(`fetchAllRacePages` in ergast.ts). Points progression is summed from results + sprints, which matches
official standings exactly.
GET /drivers/{driverId}.json

### FIA documents (scripts only)
Event page: /documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/{Event%20Name}
- `..._-_pu_elements_used_per_driver_up_to_now.pdf` — cumulative ICE/TC/EXH/MGU-K/ES/PU-CE/PU-ANC per driver
- `..._-_infringement_-_car_NN_-_pu_elements_changed*.pdf` — which elements, grid drop / pit-lane start

## Static Data Files (src/data/)
- paceRatings.json — committed pace ratings (seed); newer rounds come from /api/pace (server/pace.ts),
  which computes one finished round per call ≥1 day after the race (OpenF1 data settled) and stores it in
  Vercel Blob `pace/<season>.json`. Daily cron 07:00 UTC. Seasons with no seed (e.g. 2025) fill in the
  same way, one round per call. Stores each team's gap to the best team in % per round and dimension;
  src/lib/pace.ts turns gaps into 0–100 scores (1 pt per 0.1% for lap times, per 0.2% for speeds).
  Local `npm run pace` (scripts/pace/index.ts, shared compute.ts) is only for regenerating the seed.
- powerUnits.json — GENERATED by `npm run pu` (scripts/fia-pu, do not hand-edit): per round, each car's
  cumulative element counts after the weekend (Friday "PU elements used" report + "new PU elements"
  doc) and PU penalties (stewards' infringement decisions). Seeds /api/power-units (server/power-units.ts),
  which re-checks fia.com at most every 3 h for new events + the latest one; stored in Vercel Blob
  `power-units/<season>.json`. PDF parsing only — no AI, no API cost. 2026 limits in src/lib/powerUnits.ts
  (B8.2.2 + B8.2.3a): ICE/TC/EXH 4, MGU-K/ES/PU-CE 3, PU-ANC 6. FIA numbers are shown as published
  (e.g. Antonelli EXH 4 → 3 between the R12 and R13 reports is the FIA's own revision).
- regulations.json — manual: reg-change cards (optional `live`: "suppliers" | "teamPoints:<id>") + ADUO
  (thresholds, periods by circuitId range, manufacturer status from the FIA's published results).
  The FIA publishes ADUO results as news articles, not event documents — cite them in `sources`.
- contracts.json — manual, keyed by Jolpica driverId; teams come live from standings. Automatic layer:
  each race summary also returns confirmed contract announcements (same Claude call) from race articles +
  contract stories since the previous race; kept only if the driver is in the results and any expiry year
  appears in the cited article. Shown as "Latest"/"Moving"/"Leaving" on the driver card; a newer one
  overrides the expiry chip. Race seats only (junior/reserve/test deals dropped via f1RaceSeat).
  Cards: only drivers with contract info (manual or automatic) — stand-ins without any are listed in a note.
  Newcomers (announced, no F1 results yet) get "new:<slug>" ids and a card under "Signed for next season";
  hand-added newcomers go in contracts.json `incoming` (name, nationality, team constructorId, status…). Both files carry
  `asOfRound`/`reviewedOn`; the tabs show "Review due" once a newer round has been raced.
- raceNews.json — committed press summaries (R14) that seed /api/news; newer races live in Vercel Blob.
  Per round: headline, bullets citing source ids, verified quotes, source list, link-only headlines.
  Model claude-sonnet-5 (~$0.08/race; tested 2026-09-24: Haiku 4.5 made factual errors, Opus 5 ~2.5× cost).
- raceNotes.json — manual (fallback when a round has no raceNews entry): `{ "<season>": { asOfRound, rounds: { "<round>": ["**bold** bullet", …] },
  cancelled: { "<OpenF1 meeting_name>": "reason" } } }`. Shown as "Notes" under the auto race facts.

## Data Rules
- No AI/LLM calls from the browser. The only Claude call is server-side in /api/news, once per race
  (then stored); every page load just reads stored summaries
- No authentication required
- OpenF1 primary, Jolpica fallback for older seasons
- 2026 uses new technical regulations — never interpolate from 2025 data
- Never hard-code a number the APIs can provide (points, rounds, sprint counts, dates, positions)
- The API is the source of truth. Where the mockup or hand-written notes disagree with it, the mockup is
  wrong (it was updated by hand) — use the API value and correct the note
- Heavy telemetry and PDF parsing run in scripts (locally or scheduled CI), never in the browser
- Pace dimensions without a direct measurement are approximations — label them as such in the UI

## TanStack Query Cache Strategy
- Race weekend (FP1 → Monday after, from the Jolpica schedule): staleTime = 5 min
- Between races: staleTime = 1 hour

## Mobile Breakpoints
< 640px   — single column, bottom nav, swipeable tabs (Embla), filter in bottom sheet
640–1024px — 2-col grid, top nav
> 1024px  — sidebar + main, full-width charts

## Build Order
Done: Phase 1 (live Standings + points progression, mockup styling), Phase 2 (Race by Race with auto facts),
Phase 3 (pace pipeline + Pace Profiles tab), Phase 4 (FIA PU scraper + component usage panel),
Phase 5 (Form Guide computed; Reg Changes/ADUO and Driver Contracts from manual JSON). All 6 tabs live.
api/ holds bundled functions (news.js, power-units.js) and api/_chunks/ shared code — underscore paths
aren't endpoints. Rebuild with `npm run build:api` after editing server/ or the shared scripts.
Scripts in scripts/ run with Node's type stripping (Node 22+): imports need explicit .ts extensions,
no enums/namespaces. scripts/lib/api.ts throttles, retries 429s and caches OpenF1 responses in scripts/.cache.
OpenF1 calls go through a throttled queue in openf1.ts (350 ms spacing, 429 retry) — keep using it.
Dev server: http://localhost:5180 (port pinned in vite.config.ts; 5173 belongs to another app).
Remaining work is tracked in `.claude/todo.md`.
