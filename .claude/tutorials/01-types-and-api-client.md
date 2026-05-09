# Tutorial 01 — TypeScript Types & API Clients

## What we built
- `src/types/f1.ts` — shared app-level type definitions
- `src/lib/ergast.ts` — typed Ergast API client

---

## Part 1 — TypeScript Interfaces

An `interface` describes the shape of an object. TypeScript uses it at compile time to catch mistakes — it generates no runtime code.

```ts
export interface Driver {
  driverId: string      // e.g. "max_verstappen"
  code: string          // e.g. "VER"
  permanentNumber: string
  givenName: string
  familyName: string
  nationality: string
  dateOfBirth: string
}
```

If you try to access `driver.name` TypeScript will error immediately — `name` isn't in the interface.

### Composition
Instead of repeating fields, reference another interface directly:

```ts
export interface DriverStanding {
  position: number
  points: number
  wins: number
  driver: Driver        // ← uses the Driver interface
  constructor: Constructor
}
```

### Optional fields
A `?` marks a field as optional — TypeScript won't complain if it's absent:

```ts
export interface RaceResult {
  time?: string         // absent for DNFs
  fastestLap?: { rank: number; lap: number; time: string }
}
```

The inline `{ rank: number; lap: number; time: string }` is an **inline object type** — useful for small nested shapes that don't need their own named interface.

### Arrays
`SomeType[]` means "an array of SomeType":

```ts
export interface Race {
  results: RaceResult[]   // array of RaceResult objects
}
```

---

## Part 2 — Union Types & Constants

### Union type
Restricts a value to a fixed set of strings. TypeScript errors on any typo:

```ts
export type TeamId =
  | "mercedes"
  | "red_bull"
  | "ferrari"
  // ...etc
```

`type` (not `interface`) is used here because this isn't an object shape — it's a set of allowed values.

### Record
`Record<K, V>` is a built-in TypeScript generic meaning "an object where every key is type K and every value is type V":

```ts
export const TEAM_COLORS: Record<TeamId, string> = {
  mercedes: "#00D2BE",
  red_bull: "#3671C6",
  // ...etc
}
```

TypeScript will error if you miss a team or misspell a key.

---

## Part 3 — The `.ts` vs `.tsx` Distinction

| Extension | Contains | Examples |
|---|---|---|
| `.ts` | Pure TypeScript — logic, types, functions | API clients, hooks, stores, utilities |
| `.tsx` | TypeScript + JSX (React UI syntax) | Components, pages |

---

## Part 4 — API Client Pattern (`ergast.ts`)

### Why a dedicated API client?
Instead of scattering `fetch()` calls across components, you centralise all API logic in one module. If the API changes, you fix one place.

### The dependency chain
```
API client (ergast.ts)
    ↓  returns clean types from f1.ts
Hooks (useDriverStandings.ts, etc.)
    ↓  TanStack Query lives here
Components (StandingsTab.tsx, etc.)
```

### Internal vs exported interfaces
Ergast returns messy raw JSON — deeply nested, numbers as strings, PascalCase keys. We type that raw shape with **internal interfaces** (not exported) so TypeScript can navigate it safely. Consumers of this module never see the raw shape.

```ts
// Internal — describes what Ergast actually sends
interface ErgastDriver {
  driverId: string
  permanentNumber: string
  // ...etc
}

// Exported — the clean shape components use (from f1.ts)
export interface Driver {
  driverId: string
  // ...etc
}
```

### Generic fetch function

`<T>` is a **type parameter** — a placeholder filled in by the caller:

```ts
async function ergastFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`Ergast fetch failed: ${res.status}`)
  return res.json() as Promise<T>
}
```

- `Promise<T>` is the return type — an async function always returns a Promise
- `as Promise<T>` is a type assertion — telling TypeScript "trust us, this JSON matches T"
- The caller decides what T is: `ergastFetch<DriverStandingsResponse>('/...')`

### Response envelope interfaces
Ergast wraps everything in `MRData`. We create named interfaces for these wrappers so call sites stay readable:

```ts
interface DriverStandingsResponse {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{ DriverStandings: ErgastDriverStandingEntry[] }>
    }
  }
}
```

### Exported functions — fetch + transform

Each exported function:
1. Calls `ergastFetch` with the right response type
2. Navigates the nested response to the data
3. Maps raw Ergast entries to clean `f1.ts` types

```ts
export async function fetchDriverStandings(season: number): Promise<DriverStanding[]> {
  const data = await ergastFetch<DriverStandingsResponse>(`/${season}/driverStandings.json`)
  const entries = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
  return entries.map(entry => ({
    position: parseInt(entry.position),   // Ergast sends numbers as strings
    points: parseFloat(entry.points),     // parseFloat handles "8.5" (bonus points)
    wins: parseInt(entry.wins),
    driver: { ...entry.Driver },
    constructor: { ...entry.Constructors[0] }  // Constructors is an array, we take [0]
  }))
}
```

### Key operators used

| Operator | Meaning | Example |
|---|---|---|
| `?.` | Optional chaining — returns `undefined` instead of crashing if left side is nullish | `arr[0]?.field` |
| `??` | Nullish coalescing — fallback if left side is `null`/`undefined` | `value ?? []` |
| `.map()` | Transforms every item in an array | `entries.map(e => ({ ... }))` |
| `parseInt()` | Converts string to integer | `parseInt("1")` → `1` |
| `parseFloat()` | Converts string to decimal number | `parseFloat("8.5")` → `8.5` |

### Helper functions avoid duplication
When two exported functions need the same mapping logic, extract it:

```ts
// One place to maintain
function mapRace(race: ErgastRace): Race {
  return { ... }
}

// Both functions call it
export async function fetchRaceResults(...) {
  ...
  return mapRace(data.MRData.RaceTable.Races[0])
}

export async function fetchAllRaces(...) {
  ...
  return data.MRData.RaceTable.Races.map(mapRace)
}
```

---

## Part 5 — `import type`

```ts
import type { Driver, Constructor } from '../types/f1'
```

The `type` keyword tells TypeScript these imports are type-only. They're erased completely at build time — a small optimization that also makes the import intent explicit.

---

## Summary

| Concept | Where used |
|---|---|
| `interface` | All types in `f1.ts`, internal Ergast types |
| `type` (union) | `TeamId` |
| `Record<K,V>` | `TEAM_COLORS` |
| Optional fields `?` | `RaceResult.time`, `RaceResult.fastestLap` |
| Generic function `<T>` | `ergastFetch<T>` |
| `Promise<T>` return type | All async functions |
| `?.` and `??` | Navigating nested API responses |
| `.map()` | Transforming arrays of raw data |
| `parseInt` / `parseFloat` | Converting Ergast string numbers |
| Internal interfaces | Raw Ergast response shapes |
| Helper functions | `mapRace` |

---

## Next
`src/lib/openf1.ts` — same pattern, simpler responses (flat arrays, no deep nesting).
