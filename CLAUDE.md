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
- Driver numbers → OpenF1 `/drivers` (team colours are the mockup palette in `src/lib/teams.ts`)
- Race facts (SC/VSC, steward penalties, pit stops, tyre stints, overtakes, weather) → OpenF1
- Everything derived: title-eligibility pills, max points remaining (uses real sprint count), gaps,
  zone headers, constructor badges, "next race", numeric narrative sentences

Pre-computed by scripts in `scripts/` → committed JSON in `src/data/`:
- Pace ratings (OpenF1 laps + car_data), PU element usage + penalties (FIA PDFs)

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
- paceRatings.json — GENERATED by `scripts/pace` (do not hand-edit)
- powerUnits.json — GENERATED by `scripts/fia-pu` (do not hand-edit)
- contracts.json, aduo.json, regulations.json — manual, each with `asOfRound`
- raceNotes.json — manual: `{ "<season>": { asOfRound, rounds: { "<round>": ["**bold** bullet", …] },
  cancelled: { "<OpenF1 meeting_name>": "reason" } } }`. Shown as "Notes" under the auto race facts.

## Data Rules
- No AI/LLM calls at runtime
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
Done: Phase 1 (live Standings + points progression, mockup styling), Phase 2 (Race by Race with auto facts).
Pace Profiles is still the v1 version until phase 3.
OpenF1 calls go through a throttled queue in openf1.ts (350 ms spacing, 429 retry) — keep using it.
Dev server: http://localhost:5180 (port pinned in vite.config.ts; 5173 belongs to another app).
Remaining work is tracked in `.claude/todo.md`.
