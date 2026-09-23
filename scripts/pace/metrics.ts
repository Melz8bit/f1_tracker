// Pace metrics for one race weekend. Every metric is a team's gap to the best team, in percent
// (0 = best on the grid). The app turns gaps into 0–100 scores.

export interface Lap {
    driver_number: number;
    lap_number: number;
    date_start: string | null;
    lap_duration: number | null;
    is_pit_out_lap: boolean;
    st_speed: number | null;
}

export interface RaceControlMessage {
    lap_number: number | null;
    category: string;
    flag: string | null;
    message: string;
    date: string;
}

export interface Stint {
    driver_number: number;
    stint_number: number;
    lap_start: number;
    lap_end: number;
}

export interface CarSample {
    date: string;
    speed: number;
}

export type TeamOf = (driverNumber: number) => string | undefined
export type Gaps = Record<string, number>

// ── helpers ───────────────────────────────────────────────────────

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

function groupBy<T>(items: T[], key: (item: T) => string | undefined): Map<string, T[]> {
    const groups = new Map<string, T[]>()
    for (const item of items) {
        const k = key(item)
        if (k === undefined) continue
        groups.set(k, [...(groups.get(k) ?? []), item])
    }
    return groups
}

// Lower is better (lap times): gap = how much slower than the best, in %
function timeGaps(values: Map<string, number>): Gaps {
    const best = Math.min(...values.values())
    return Object.fromEntries([...values].map(([team, v]) => [team, (v / best - 1) * 100]))
}

// Higher is better (speeds): gap = how much slower than the best, in %
function speedGaps(values: Map<string, number>): Gaps {
    const best = Math.max(...values.values())
    return Object.fromEntries([...values].map(([team, v]) => [team, (1 - v / best) * 100]))
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

export function roundGaps(gaps: Gaps): Gaps {
    return Object.fromEntries(Object.entries(gaps).map(([team, gap]) => [team, round3(gap)]))
}

// ── qualifying ────────────────────────────────────────────────────

// Each team's single fastest qualifying lap
export function qualifyingGaps(laps: Lap[], teamOf: TeamOf): Gaps {
    const best = new Map<string, number>()
    for (const lap of laps) {
        const team = teamOf(lap.driver_number)
        if (!team || !lap.lap_duration || lap.is_pit_out_lap) continue
        best.set(team, Math.min(best.get(team) ?? Infinity, lap.lap_duration))
    }
    return best.size ? timeGaps(best) : {}
}

export function fastestLapPerTeam(laps: Lap[], teamOf: TeamOf): Map<string, Lap> {
    const best = new Map<string, Lap>()
    for (const lap of laps) {
        const team = teamOf(lap.driver_number)
        if (!team || !lap.lap_duration || !lap.date_start || lap.is_pit_out_lap) continue
        const current = best.get(team)
        if (!current || lap.lap_duration < current.lap_duration!) best.set(team, lap)
    }
    return best
}

// ── race pace ─────────────────────────────────────────────────────

// Laps under safety car, VSC or red flag, from race control (one lap of margin either side)
export function neutralisedLaps(messages: RaceControlMessage[]): Set<number> {
    const laps = new Set<number>()
    let start: number | null = null
    for (const m of [...messages].sort((a, b) => a.date.localeCompare(b.date))) {
        const lap = m.lap_number
        if (lap === null) continue
        const deployed = m.category === 'SafetyCar' && m.message.includes('DEPLOYED')
        const red = m.category === 'Flag' && m.flag === 'RED'
        const ended = m.category === 'SafetyCar' && (m.message.includes('ENDING') || m.message.includes('IN THIS LAP'))
        const resumed = m.category === 'Flag' && m.flag === 'GREEN' && start !== null
        if ((deployed || red) && start === null) start = lap
        if ((ended || resumed) && start !== null) {
            for (let l = start - 1; l <= lap + 1; l++) laps.add(l)
            start = null
        }
    }
    if (start !== null) for (let l = start - 1; l <= start + 3; l++) laps.add(l)
    return laps
}

// Compare teams lap by lap (same lap = similar fuel load and track state): on every lap take each
// team's fastest clean lap, measure it against the fastest team that lap, then take the median.
export function raceGaps(laps: Lap[], stints: Stint[], messages: RaceControlMessage[], teamOf: TeamOf): Gaps {
    const neutralised = neutralisedLaps(messages)
    const inLaps = new Set<string>()
    const lastStint = new Map<number, number>()
    for (const s of stints) lastStint.set(s.driver_number, Math.max(lastStint.get(s.driver_number) ?? 0, s.stint_number))
    for (const s of stints) if (s.stint_number < (lastStint.get(s.driver_number) ?? 0)) inLaps.add(`${s.driver_number}:${s.lap_end}`)

    const clean = laps.filter(l =>
        l.lap_duration !== null &&
        l.lap_number > 1 &&
        !l.is_pit_out_lap &&
        !neutralised.has(l.lap_number) &&
        !inLaps.has(`${l.driver_number}:${l.lap_number}`))

    const ratiosByTeam = new Map<string, number[]>()
    for (const [, lapGroup] of groupBy(clean, l => String(l.lap_number))) {
        const lapMedian = median(lapGroup.map(l => l.lap_duration!))
        const teamBest = new Map<string, number>()
        for (const l of lapGroup) {
            const team = teamOf(l.driver_number)
            // Drop incident laps (spins, damage, traffic jams) — well off the pace of the field that lap
            if (!team || l.lap_duration! > lapMedian * 1.05) continue
            teamBest.set(team, Math.min(teamBest.get(team) ?? Infinity, l.lap_duration!))
        }
        if (teamBest.size < 6) continue // Too few teams to compare fairly
        const fastest = Math.min(...teamBest.values())
        for (const [team, time] of teamBest) ratiosByTeam.set(team, [...(ratiosByTeam.get(team) ?? []), time / fastest])
    }

    // Median ratio per team, re-based so the best team is exactly 0
    const medians = new Map([...ratiosByTeam].filter(([, r]) => r.length >= 5).map(([team, r]) => [team, median(r)]))
    return medians.size ? timeGaps(medians) : {}
}

// ── straight-line speed ───────────────────────────────────────────

// 90th percentile of speed-trap readings across qualifying and clean race laps. A percentile rather
// than the max, so one tow or overtake-mode burst doesn't decide it.
export function straightLineGaps(lapsBySession: Lap[][], teamOf: TeamOf): Gaps {
    const speeds = new Map<string, number[]>()
    for (const laps of lapsBySession) {
        for (const l of laps) {
            const team = teamOf(l.driver_number)
            if (!team || !l.st_speed || l.is_pit_out_lap) continue
            speeds.set(team, [...(speeds.get(team) ?? []), l.st_speed])
        }
    }
    const p90 = new Map([...speeds].filter(([, s]) => s.length >= 5).map(([team, s]) => [team, percentile(s, 0.9)]))
    return p90.size ? speedGaps(p90) : {}
}

// ── cornering ─────────────────────────────────────────────────────

export interface CornerResult {
    slow: Gaps; // Apex under SLOW_KMH
    high: Gaps; // Apex at or over HIGH_KMH
    corners: { slow: number; medium: number; high: number };
}

const SLOW_KMH = 130
const HIGH_KMH = 185
// A corner loses PROMINENCE_KMH on one side and at least MIN_REGAIN_KMH on the other. Corners in a
// sequence (Suzuka's esses) regain little before the next one; energy-clipping dips on straights
// regain nothing, because speed keeps falling into the next braking zone.
const PROMINENCE_KMH = 15
const MIN_REGAIN_KMH = 5
const POINTS = 1000 // Every lap is resampled to this many evenly spaced points around the lap
const ZONE = 15 // Corner zone: ±1.5% of the lap around the apex
const NEIGHBOURHOOD = 50 // ±5% of the lap: where the braking zone and exit are looked for
const MAX_SHIFT = 30 // Alignment search: ±3% of the lap
const OUTLIER = 0.1 // A corner reading >10% off the field median is a misalignment, not pace

// Speed at POINTS evenly spaced positions around the lap
export type Trace = number[]

// Integrate speed over time to get distance, normalise to the lap, then resample evenly
export function toTrace(samples: CarSample[]): Trace | undefined {
    if (samples.length < 50) return undefined
    const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date))
    const distance = [0]
    for (let i = 1; i < sorted.length; i++) {
        const dt = (Date.parse(sorted[i].date) - Date.parse(sorted[i - 1].date)) / 1000
        distance.push(distance[i - 1] + (sorted[i - 1].speed / 3.6) * dt)
    }
    const total = distance[distance.length - 1]
    const trace: Trace = []
    let j = 0
    for (let k = 0; k < POINTS; k++) {
        const d = (k / POINTS) * total
        while (j < distance.length - 2 && distance[j + 1] < d) j++
        const span = distance[j + 1] - distance[j] || 1
        const t = Math.min(1, Math.max(0, (d - distance[j]) / span))
        trace.push(sorted[j].speed + t * (sorted[j + 1].speed - sorted[j].speed))
    }
    return trace
}

const at = (trace: Trace, k: number) => trace[((k % POINTS) + POINTS) % POINTS]

// Telemetry windows start at slightly different points for each car, so slide every trace to where it
// best matches the reference (least squared difference) before comparing corners
function align(reference: Trace, trace: Trace): Trace {
    let bestShift = 0
    let bestError = Infinity
    for (let shift = -MAX_SHIFT; shift <= MAX_SHIFT; shift++) {
        let error = 0
        for (let k = 0; k < POINTS; k++) error += (reference[k] - at(trace, k + shift)) ** 2
        if (error < bestError) {
            bestError = error
            bestShift = shift
        }
    }
    return reference.map((_, k) => at(trace, k + bestShift))
}

// Apexes = local speed minima with a real braking zone or acceleration around them
export function findApexes(trace: Trace): number[] {
    const apexes: number[] = []
    for (let k = 1; k < POINTS - 1; k++) {
        if (trace[k] > trace[k - 1] || trace[k] > trace[k + 1]) continue
        let before = 0
        let after = 0
        for (let d = 1; d <= NEIGHBOURHOOD; d++) {
            before = Math.max(before, at(trace, k - d))
            after = Math.max(after, at(trace, k + d))
        }
        const drop = before - trace[k]
        const regain = after - trace[k]
        if (Math.max(drop, regain) < PROMINENCE_KMH || Math.min(drop, regain) < MIN_REGAIN_KMH) continue
        // One apex per corner: keep the lower of two minima that are very close together
        const last = apexes[apexes.length - 1]
        if (last !== undefined && k - last < ZONE * 2) {
            if (trace[k] < trace[last]) apexes[apexes.length - 1] = k
            continue
        }
        apexes.push(k)
    }
    return apexes
}

// Average speed through the corner zone: closer to "time spent in the corner" than the minimum speed
function cornerSpeed(trace: Trace, apex: number): number {
    let sum = 0
    for (let d = -ZONE; d <= ZONE; d++) sum += at(trace, apex + d)
    return sum / (ZONE * 2 + 1)
}

// Corners are found on the reference team's lap (the fastest in qualifying) and classified by its apex
// speed; every team's aligned trace is then compared through each corner zone
export function cornerGaps(traces: Map<string, Trace>, referenceTeam: string): CornerResult {
    const empty: CornerResult = { slow: {}, high: {}, corners: { slow: 0, medium: 0, high: 0 } }
    const reference = traces.get(referenceTeam)
    if (!reference) return empty
    const aligned = new Map([...traces].map(([team, trace]) => [team, team === referenceTeam ? trace : align(reference, trace)]))

    const ratios = { slow: new Map<string, number[]>(), high: new Map<string, number[]>() }
    const corners = { slow: 0, medium: 0, high: 0 }
    for (const apex of findApexes(reference)) {
        const speeds = new Map([...aligned].map(([team, trace]) => [team, cornerSpeed(trace, apex)]))
        const fieldMedian = median([...speeds.values()])
        for (const [team, v] of speeds) if (Math.abs(v / fieldMedian - 1) > OUTLIER) speeds.delete(team)
        if (speeds.size < 6) continue

        const kind = reference[apex] < SLOW_KMH ? 'slow' : reference[apex] >= HIGH_KMH ? 'high' : 'medium'
        corners[kind]++
        if (kind === 'medium') continue
        const best = Math.max(...speeds.values())
        for (const [team, v] of speeds) ratios[kind].set(team, [...(ratios[kind].get(team) ?? []), v / best])
    }

    const toGaps = (byTeam: Map<string, number[]>): Gaps => {
        if (!byTeam.size) return {}
        const mean = new Map([...byTeam].map(([team, r]) => [team, r.reduce((a, b) => a + b, 0) / r.length]))
        return speedGaps(mean)
    }
    return { slow: toGaps(ratios.slow), high: toGaps(ratios.high), corners }
}

// ── active aero (estimate) ────────────────────────────────────────

// No public data isolates the active-aero system. A car that is quick on the straights (low drag in
// straight mode) AND through fast corners (downforce in corner mode) is using it efficiently, so the
// estimate is the mean of those two gaps. Labelled "estimated" in the UI.
export function aeroGaps(straight: Gaps, high: Gaps): Gaps {
    const teams = Object.keys(straight).filter(team => team in high)
    if (!teams.length) return {}
    const combined = new Map(teams.map(team => [team, (straight[team] + high[team]) / 2]))
    const best = Math.min(...combined.values())
    return Object.fromEntries([...combined].map(([team, gap]) => [team, gap - best]))
}
