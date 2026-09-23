import type { Race, RaceResult } from '../types/f1'

export interface ProgressionSeries {
    id: string;
    total: number; // Cumulative points at the last round shown
}

export interface Progression {
    rows: Array<{ round: number } & Record<string, number>>; // One row per round, cumulative points per id
    series: ProgressionSeries[]; // Sorted by total, highest first
}

// Cumulative points per round, built from race + sprint results. Summing results reproduces the
// official standings exactly (verified for 2026), and costs 2 requests instead of 1 per round.
export function buildProgression(
    races: Race[],
    sprints: Race[],
    keyOf: (r: RaceResult) => string,
    fromRound: number,
    toRound: number,
): Progression {
    const pointsByRound = new Map<number, Map<string, number>>()
    for (const event of [...races, ...sprints]) {
        const roundPoints = pointsByRound.get(event.round) ?? new Map<string, number>()
        for (const result of event.results) {
            const key = keyOf(result)
            roundPoints.set(key, (roundPoints.get(key) ?? 0) + result.points)
        }
        pointsByRound.set(event.round, roundPoints)
    }

    const completedRounds = races.filter(r => r.results.length > 0).map(r => r.round).sort((a, b) => a - b)
    // Start everyone at 0 so lines begin at round 1 even before a first score
    const totals = new Map<string, number>()
    for (const roundPoints of pointsByRound.values()) for (const key of roundPoints.keys()) totals.set(key, 0)
    const rows: Progression['rows'] = []
    for (const round of completedRounds) {
        if (round > toRound) break
        for (const [key, pts] of pointsByRound.get(round) ?? []) totals.set(key, (totals.get(key) ?? 0) + pts)
        if (round >= fromRound) rows.push({ round, ...Object.fromEntries(totals) })
    }

    const series = [...totals.entries()]
        .map(([id, total]) => ({ id, total }))
        .sort((a, b) => b.total - a.total)
    return { rows, series }
}
