# F1 Tracker — 2026 Season Dashboard

A Formula 1 season analytics dashboard built as a structured, session-by-session learning project using **React 18**, **TypeScript**, and a modern frontend stack. The app pulls live data from two public F1 APIs, aggregates it client-side, and displays it in a dark-themed, data-dense UI inspired by broadcast graphics.

> **Learning context:** This project is being built incrementally through a Claude Code tutorial workflow — one feature area per session, concepts explained before implementation. Each session builds on patterns from the last, with increasing independence over time.

---

## Live Features

| Tab | Data Source | Description |
|---|---|---|
| **Standings** | Jolpica (Ergast mirror) | Driver & Constructor championship standings |
| **Race by Race** | Jolpica | Per-round race results + sprint results |
| **Speed Trap** | OpenF1 | Top speeds recorded per driver in the latest race |
| **Pace Profile** | Static JSON | Team pace ratings visualised as a Recharts bar chart |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v3 |
| State management | Zustand |
| Data fetching & caching | TanStack Query v5 |
| Charts | Recharts |
| Routing | React Router v6 |
| Mobile tabs | Embla Carousel |
| Primary API | [OpenF1](https://openf1.org) — real-time F1 telemetry |
| Fallback API | [Jolpica](https://api.jolpi.ca) — Ergast mirror for standings & results |
| Hosting | Vercel |

---

## Project Structure

```
src/
├── components/dashboard/   # One component per dashboard tab
├── data/                   # Static JSON (pace ratings, verdicts, circuits)
├── lib/                    # API clients (openf1.ts, ergast.ts)
├── pages/                  # Route-level components
├── store/                  # Zustand global filter store
└── types/                  # Shared TypeScript interfaces
```

---

## Roadmap

### Completed
- [x] Project scaffold (Vite, Tailwind, React Router, TanStack Query, Zustand)
- [x] TypeScript interfaces for all F1 data types
- [x] OpenF1 + Jolpica API clients with generic fetch wrappers
- [x] Global filter store (season, round range) with Zustand
- [x] Standings tab — driver & constructor tables
- [x] Race by Race tab — race results + sprint results with conditional rendering
- [x] Speed Trap tab — top speeds from OpenF1 laps endpoint, grouped client-side
- [x] Pace Profile tab — Recharts bar chart with team brand colors

### In Progress / Upcoming
- [ ] Verdicts tab — editorial team summaries (static JSON)
- [ ] Points Progression Chart — cumulative points over rounds
- [ ] Full layout — TopNav, Sidebar, BottomNav, mobile bottom sheet filter
- [ ] Calendar page — full season schedule
- [ ] Race Detail page — deep dive per round
- [ ] Driver Profile page
- [ ] Constructor Profile page
- [ ] Mobile polish (Embla swipeable tabs, responsive breakpoints)
- [ ] Computed pace ratings from API data (replacing manual JSON)

---

## Concepts Covered

This section tracks the React/TypeScript concepts introduced each session — useful for demonstrating progressive skill development.

### TypeScript
- Interfaces, composition, and optional fields (`?`)
- Union types (`type TeamId = "mercedes" | "ferrari" | ...`)
- Generic functions (`fetch<T>`) and generic utility types (`Record<K, V>`)
- Type guards (`(s): s is number => s !== null`)
- Type-only imports (`import type`)
- `as` casting for dynamic JSON indexing

### React & Hooks
- `useState`, component state
- Conditional rendering (`&&`, ternary)
- React Fragments (`<></>`) — grouping without a DOM element
- `key` prop and why it matters in lists
- `import` patterns — default vs named exports

### TanStack Query (React Query v5)
- `useQuery` — data fetching with automatic caching
- `queryKey` as a cache address (changes trigger re-fetch)
- `staleTime` — cache freshness window (1 hour between races, 5 min on race weekends)
- `enabled` — dependent/chained queries
- `useQueries` — parallel dynamic queries
- Rename destructuring: `{ data: driversData, isLoading: driversLoading }`

### Zustand
- Global store definition and slice pattern
- Subscribing to store state in components

### Array Methods
- `.map()`, `.filter()`, `.find()`, `.sort()`, `.some()`, `.every()`
- `.map((item, i) => ...)` — index access
- `.at(-1)` — last item
- `.reduce()` — accumulate to a single value
- `Object.entries()`, `Object.keys()`, `Object.values()`
- `Math.max(...array)` — spread array as individual arguments
- `?? []` nullish coalescing to guarantee an array type

### APIs & Architecture
- OpenF1 vs Ergast API design (flat arrays vs nested envelopes)
- Rate limiting (429) — root cause and fix (22 parallel requests → 1 request + client-side grouping)
- Dependent queries — waiting for session before fetching drivers
- `new Date(str) < new Date()` — filtering past vs future sessions
- JSON import in TypeScript (no fetch needed for static data)

### Recharts
- `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`
- `ResponsiveContainer` — fluid chart width
- `Cell` — per-bar color override
- `domain` — controlling Y-axis range for better visual differentiation

### React Router v6
- `BrowserRouter`, `Routes`, `Route`
- `main.tsx` vs `App.tsx` — entry point vs root component

---

## Design System

Dark carbon-fibre aesthetic, data-dense layout.

- **Background:** `#0a0a0f`
- **Surface:** `#111118`
- **Borders:** `#1e1e2e`
- **Accent:** `#e10600` (F1 red)
- **Text:** `#e8e8f0` / `#999` / `#666`
- Monospace font for all data values (times, speeds, points)

### Team Colors (2026)

| Team | Color |
|---|---|
| Mercedes | `#00D2BE` |
| Red Bull | `#3671C6` |
| Ferrari | `#E8002D` |
| McLaren | `#FF8000` |
| Aston Martin | `#358C75` |
| Alpine | `#FF87BC` |
| Williams | `#64C4FF` |
| Haas | `#B6BABD` |
| Audi | `#C0C0C0` |
| Racing Bulls | `#6692FF` |
| Cadillac | `#FFFFFF` |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

No API keys required — both OpenF1 and Jolpica are public APIs.

---

## Data Sources

- **[OpenF1 API](https://openf1.org)** — Real-time F1 telemetry: sessions, drivers, laps, car data, intervals, pit stops.
- **[Jolpica](https://api.jolpi.ca)** — Community-maintained Ergast mirror: standings, race results, qualifying. Ergast was decommissioned end of 2024.
- **Static JSON** (`src/data/`) — Pace ratings and editorial verdicts, manually curated after each race weekend.
