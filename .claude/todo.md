# Todo

Goal: mirror `f1_2026_dashboard.html` as a fully API-driven app (see CLAUDE.md → Data Sources).

## Phase 1 — Live data core ✅ (2026-09-23)
- [x] Remove Speed Trap tab (`SpeedTrapTab.tsx`, `useOpenF1CarData.ts` if unused, Home.tsx wiring)
- [x] `ergast.ts`: extract `mapResult` helper (dedupe `mapRace` / `fetchAllSprints`)
- [x] Season hook: schedule + sprint flags → rounds done/left, latest/next race
- [x] Cancelled rounds from OpenF1 `is_cancelled` (done in Phase 2 via `/meetings`)
- [x] Championship math util: max remaining pts (drivers 25/race + 8/sprint; constructors 43/race + 15/sprint), title pills, zone headers
- [x] Standings tab to mockup parity: metric cards, constructor badges (auto from latest results), driver table with flags + team colours
- [x] Points progression charts summed from race + sprint results (constructors top 5, drivers top 7)

## Phase 2 — Race by Race ✅ (2026-09-23)
- [x] Summary table incl. cancelled rows in date order, sprint tag, latest auto-expanded
- [x] Expanded results: sprint + GP tables (grid, Δ, pts, DNF/DNS, pit-lane start)
- [x] Auto race facts from OpenF1: SC/VSC, steward penalties, pit stops, stints, overtakes, weather, biggest gainer
- [x] `raceNotes.json` editorial bullets keyed by round (R1–R14 ported from the mockup)
- [ ] Correct hand-written notes in raceNotes.json to match the API (API wins) — e.g. R14 "VSC lap 16" → laps 14–15, "Audi 30 constructor pts" → 17
- [ ] Pit stop times: OpenF1 `stop_duration` is always null in 2026 and `lane_duration` has outliers — revisit if the feed improves

## Decision pending (user)
- [ ] Source for race notes + season/Form Guide summaries: facts only / hand-written / post-weekend script drafting / scraping sources / Wikipedia link-out (Jolpica race URL). User will decide.

## Phase 3 — Pace pipeline (`scripts/pace`)
- [ ] Qualifying one-lap: team best lap, % gap to pole per round
- [ ] Race pace: median clean-lap gap (exclude in/out laps, SC/VSC laps from race_control)
- [ ] Straight-line: speed trap / intermediate speeds
- [ ] Cornering (approx): fastest quali lap per team → car_data speed trace by distance, detect corners as speed minima, match across teams, classify apex speed slow/medium/high, score per class
- [ ] Active aero efficiency (approx proxy): top speed vs high-speed-corner performance, labelled "estimated"
- [ ] Normalise to 100 = best, average over filter range; tiers from overall score
- [ ] Rate-limit-safe throttling; write `src/data/paceRatings.json`

## Phase 4 — FIA PU pipeline (`scripts/fia-pu`)
- [ ] Crawl event pages → find `pu_elements_used_per_driver_up_to_now.pdf` + `infringement_-_car_NN_-_pu_elements*.pdf`
- [ ] Parse PDFs in Node (pdfjs-dist, x/y coordinates — pdftotext merges digits in layout mode)
- [ ] Output `src/data/powerUnits.json`: per-driver per-round element counts (7 elements incl. PU-ANC) + penalties (elements, grid drop / pit-lane)
- [ ] Verify 2026 element allocation limits from the FIA Sporting Regulations (mockup's values unverified)
- [ ] Component usage panel in Pace Profiles

## Phase 5 — Manual-data tabs
- [ ] `regulations.json` + Reg Changes tab (with live-computed claims)
- [ ] `aduo.json` + ADUO tracker (review-window race lists derived from schedule)
- [ ] Form Guide: auto cards (leader, wins, next race, closest fight, biggest DNF) + optional manual cards
- [ ] `contracts.json` + Driver Contracts tab
- [ ] "Last reviewed Rn" staleness badge for every manual file

## Phase 6 — Automation & polish
- [ ] GitHub Action: cron after race weekends → run scripts → commit JSON → Vercel redeploy
- [ ] Layout (TopNav, Sidebar, BottomNav, routing)
- [ ] Remaining pages (Calendar, RaceDetail, DriverProfile, ConstructorProfile)
- [ ] Mobile polish

## Cleanup (needs your OK — file deletion was blocked for Claude)
- [ ] Delete unused: `src/App.css`, `src/data/circuits.json` (placeholder dates), `src/hooks/useOpenF1CarData.ts`, `src/hooks/useSeasonFilter.ts` (empty)
- [ ] Mobile: filter bar sliders + tab row at < 640px (Phase 6 polish)
