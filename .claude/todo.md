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

## Phase 2b — News pipeline (`scripts/news`) — decided 2026-09-23: scrape + summarize
- [x] Collect: RSS (The Race, RacingNews365 Atom, GPFans, PlanetF1, Crash.net) for new weekends; sitemaps with dates (The Race, RN365, PlanetF1) to backfill R1–R14
- [x] Respect robots.txt; Crash.net blocks GPTBot → headline links only, never fed to the summarizer
- [x] Match articles to a race weekend (published FP1 → race+3 days, F1 keywords), fetch pages, extract article text
- [x] Summarize offline with Claude (never at runtime): race storylines, quotes, off-track context — grounded in the articles + our API facts, API wins on numbers
- [x] Output generated notes with source links per bullet (raceNews.json + Vercel Blob)
- [ ] Season narrative text (optional — Form Guide now computes its write-ups; press headline shown there)
- [x] UI: "From the press" section with source links in Race by Race
- [x] R14 generated and reviewed (2026-09-24). Decision: no backfill — R1–R13 keep hand-written notes
- [x] Auto mode: /api/news Vercel function summarizes each new race once on page load (server/news.ts → api/news.js)
- [ ] Vercel setup (user): log in, link/import project, connect a Blob store, add ANTHROPIC_API_KEY, deploy
- [ ] After R15 (Azerbaijan, due ~Sep 28): confirm the function summarized it; check logs
- [ ] Coverage depth: feeds cover ~1–10 days; the function runs on the first page load ≥2 days after a race. If nobody opens the site for a week, only The Race (sitemap) is left — Phase 6 cron could ping /api/news daily
- [ ] PlanetF1/RN365 archive backfill — RN365 has sitemap_contentItem-recent-news*.xml (racingnews365.com/cache/site/RN365EN/sitemap/); PlanetF1 wp-sitemap-posts-post-N.xml needs page-range discovery

## Phase 3 — Pace pipeline (`scripts/pace`) ✅ (2026-09-23)
- [x] Qualifying one-lap: team best lap, % gap to pole per round
- [x] Race pace: median clean-lap gap (exclude in/out laps, SC/VSC laps from race_control)
- [x] Straight-line: speed trap / intermediate speeds
- [x] Cornering (approx): fastest quali lap per team → car_data speed trace by distance, detect corners as speed minima, match across teams, classify apex speed slow/medium/high, score per class
- [x] Active aero efficiency (approx proxy): top speed vs high-speed-corner performance, labelled "estimated"
- [x] Normalise to 100 = best, average over filter range; tiers from overall score
- [x] Rate-limit-safe throttling; write `src/data/paceRatings.json`

- [ ] Pace tuning ideas: weight rounds by corner count; medium-speed corners are detected but unused; aero proxy could use speed gain on straights once more data exists

## Phase 4 — FIA PU pipeline (`scripts/fia-pu`) ✅ (2026-09-24)
- [x] Never seed from the mockup — its component counts were estimates, frozen since R10
- [x] Crawl event pages → find `pu_elements_used_per_driver_up_to_now.pdf` + `infringement_-_car_NN_-_pu_elements*.pdf`
- [x] Parse PDFs in Node (pdfjs-dist, x/y coordinates — pdftotext merges digits in layout mode)
- [x] Output `src/data/powerUnits.json`: per-driver per-round element counts (7 elements incl. PU-ANC) + penalties (elements, grid drop / pit-lane)
- [x] Verify 2026 element allocation limits from the FIA Sporting Regulations (mockup's values unverified)
- [x] Component usage panel in Pace Profiles
- [x] Auto-update: /api/power-units re-checks fia.com every 3 h (no API cost)
- [x] PU supplier label now from the FIA entry names (static list is only a fallback)

## Phase 5 — Manual-data tabs ✅ (2026-09-24)
- [x] `regulations.json` + Reg Changes tab (live: supplier→teams from FIA entries, Cadillac points)
- [x] ADUO tracker in regulations.json, from the FIA's 26 Aug results article (corrects the mockup: Ferrari & Audi 4%+, P2 no grants); periods' races + status from the schedule; ADUO mentions from press summaries
- [ ] ADUO Period 3 result (after Mexico City, R19) — update regulations.json when the FIA publishes it
- [x] Form Guide (2026-09-24): 8 computed cards (leader, latest winner, hottest form behind the leader, fastest car, closest P2–P7 fight, reliability, PU penalty watch, next race) + drivers'/constructors' title write-ups incl. clinch maths + latest press headline
- [x] `contracts.json` (mockup data keyed by driverId) + Driver Contracts tab; teams live; contract news from press summaries
- [x] Hadjar 2027 extension + Lawson return (2026-09-24, reviewed after R14)
- [x] Automatic contract updates from the per-race summary (confirmed announcements only, verified expiry)
- [ ] Contract notes: add Tsunoda (not entered at Baku)
- [ ] After R15 (~Sep 28): check the Hadjar extension was picked up automatically
- [x] "Last reviewed Rn" / "Review due" badges on regulations + contracts

## Phase 6 — Automation & polish
- [ ] GitHub Action: cron after race weekends → run scripts → commit JSON → Vercel redeploy
  (news no longer needs this — /api/news handles it; a cron could just ping /api/news as a backstop)
- [ ] Layout (TopNav, Sidebar, BottomNav, routing)
- [ ] Remaining pages (Calendar, RaceDetail, DriverProfile, ConstructorProfile)
- [ ] Mobile polish

## Phase 7 — Move hosting to the Raspberry Pi (after the build is done; user request 2026-09-24)
- [ ] Ask how the other web apps are hosted on the Pi (reverse proxy, process manager, Docker?) and match it
- [ ] Static site: serve `dist/` (vite build)
- [ ] /api/news without Vercel: small Node server (same pipeline) — replace Vercel Blob with a JSON file on
      the Pi, replace `waitUntil` with a plain background task (a long-running server can just keep going)
- [ ] Summarizer auth on the Pi: ANTHROPIC_API_KEY in the server's env (Sonnet 5, ~$0.08/race)
- [ ] Optional: a daily systemd timer/cron to summarize new races even if nobody opens the site
- [ ] Carry over the Vercel Blob summaries (R15+) into the Pi's JSON file, then retire the Vercel project

## Cleanup (needs your OK — file deletion was blocked for Claude)
- [ ] Delete unused: `src/App.css`, `src/data/circuits.json` (placeholder dates), `src/hooks/useOpenF1CarData.ts`, `src/hooks/useSeasonFilter.ts` (empty)
- [ ] Mobile: filter bar sliders + tab row at < 640px (Phase 6 polish)
