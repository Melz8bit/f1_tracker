# F1 Dashboard — Project Reference

This file is the persistent context for Claude Code. Read it at the start of every session.

## What this app is
A Formula 1 season dashboard web app. Displays live standings, team pace analysis, speed trap data,
race-by-race results, and editorial team verdicts. Primary season: 2026. Past seasons supported.
The Home page is a 5-tab dashboard (Standings / Pace Profile / Speed Trap / Race by Race / Verdicts).

## Tech Stack
- React 18 + Vite + TypeScript
- Tailwind CSS v3
- Recharts (charts)
- Zustand (global filter state)
- TanStack Query / React Query v5 (data fetching + caching)
- React Router v6
- Embla Carousel (mobile tab swiping)
- Primary API: OpenF1 — https://api.openf1.org/v1 (no key required)
- Fallback API: Ergast — https://ergast.com/api/f1 (no key required)
- Hosting: Vercel

## Design System
- Background: #0a0a0f | Surface: #111118 | Borders: #1e1e2e
- Accent: #e10600 (F1 red)
- Text primary: #e8e8f0 | Secondary: #999 | Muted: #666
- Dark theme only. Carbon-fibre aesthetic, data-dense, high contrast.
- Monospace font for all data values (times, speeds, points)

## Team Colors (2026)
mercedes: #00D2BE | red_bull: #3671C6 | ferrari: #E8002D | mclaren: #FF8000
aston_martin: #358C75 | alpine: #FF87BC | williams: #64C4FF
haas: #B6BABD | sauber: #52E252 | racing_bulls: #6692FF

## Global Filter (Zustand — filterStore.ts)
{ season: number, roundMin: number, roundMax: number }
All 5 dashboard tabs subscribe to this store. RangeFilter.tsx renders the UI (season dropdown +
round range slider). On mobile it collapses into a bottom sheet.

## Key API Endpoints
### OpenF1
GET /sessions?year=2026
GET /drivers?session_key=...
GET /position?session_key=...
GET /laps?session_key=...&driver_number=...
GET /car_data?session_key=...&driver_number=...   ← speed trap source
GET /intervals?session_key=...
GET /pit?session_key=...

### Ergast
GET /2026/driverStandings.json
GET /2026/constructorStandings.json
GET /2026/{round}/results.json
GET /2026/results.json?limit=100
GET /2026/qualifying.json
GET /drivers/{driverId}.json

## Static Data Files (src/data/)
- paceRatings.json — team pace ratings per round, manually updated after each race weekend
- verdicts.json — editorial team summaries, updated a few times per season
- circuits.json — circuit info, locations, race dates (used for race weekend detection)

## Data Rules
- No AI/LLM calls at runtime
- No authentication required
- OpenF1 primary, Ergast fallback for older seasons
- 2026 uses new technical regulations — never interpolate from 2025 data
- paceRatings.json is manual — do not try to compute it from telemetry

## TanStack Query Cache Strategy
- Race weekend (Fri–Sun, detected via circuits.json race dates): staleTime = 5 min
- Between races: staleTime = 1 hour

## Mobile Breakpoints
< 640px   — single column, bottom nav, swipeable tabs (Embla), filter in bottom sheet
640–1024px — 2-col grid, top nav
> 1024px  — sidebar + main, full-width charts

## Build Order (session by session)
1. API clients (ergast.ts, openf1.ts)
2. Filter store + RangeFilter component
3. Tab 1 — Standings
4. Tab 4 — Race by Race
5. Tab 3 — Speed Trap
6. Tab 2 — Pace Profile
7. Tab 5 — Verdicts
8. Points Progression Chart
9. Layout (TopNav, Sidebar, BottomNav, routing)
10. Remaining pages (Calendar, RaceDetail, DriverProfile, ConstructorProfile)
11. Mobile polish
