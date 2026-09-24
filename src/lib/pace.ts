// Turns the generated gaps in paceRatings.json (% off the best team, per round) into 0–100 scores.

export type Dimension = 'straight' | 'highCorners' | 'slowCorners' | 'race' | 'quali' | 'aero'

export interface RoundPace {
    raceName: string;
    gaps: Record<Dimension, Record<string, number>>;
    corners: { slow: number; medium: number; high: number };
    sessions?: { qualifying: number; race: number }; // OpenF1 session keys used
}

export interface SeasonPace {
    generatedAt: string;
    rounds: Record<string, RoundPace>;
}

// Lap-time gaps are small (the whole grid within ~4.5%); speed gaps run about twice as wide because
// they're measured only where cars differ most. Scale each so the back of the grid lands near 60.
const POINTS_PER_PERCENT = { time: 10, speed: 5 }

// Telemetry and lap data on OpenF1 settle a few hours after the flag; compute the next day
export const PACE_DELAY_DAYS = 1

export const DIMENSIONS: Array<{ key: Dimension; label: string; kind: keyof typeof POINTS_PER_PERCENT; estimated?: boolean }> = [
    { key: 'straight', label: 'Straight-line / energy deploy', kind: 'speed' },
    { key: 'highCorners', label: 'High-speed cornering', kind: 'speed' },
    { key: 'slowCorners', label: 'Slow-speed cornering', kind: 'speed' },
    { key: 'race', label: 'Race pace', kind: 'time' },
    { key: 'quali', label: 'Qualifying one-lap', kind: 'time' },
    { key: 'aero', label: 'Active aero efficiency', kind: 'speed', estimated: true },
]

export interface TeamPace {
    team: string;
    scores: Partial<Record<Dimension, number>>;
    overall: number;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

function toScore(gap: number, kind: keyof typeof POINTS_PER_PERCENT): number {
    return Math.max(0, Math.min(100, Math.round(100 - gap * POINTS_PER_PERCENT[kind])))
}

// Average each team's gap over the rounds, then score it. Sorted best overall first.
export function scoreTeams(rounds: RoundPace[]): TeamPace[] {
    const teams = new Set(rounds.flatMap(r => Object.keys(r.gaps.quali)))
    return [...teams]
        .map(team => {
            const scores: TeamPace['scores'] = {}
            for (const d of DIMENSIONS) {
                const gaps = rounds.map(r => r.gaps[d.key][team]).filter((g): g is number => g !== undefined)
                if (gaps.length) scores[d.key] = toScore(mean(gaps), d.kind)
            }
            const values = Object.values(scores)
            return { team, scores, overall: values.length ? Math.round(mean(values)) : 0 }
        })
        .sort((a, b) => b.overall - a.overall)
}

// Change in overall score from the latest round alone vs the rounds before it
export function latestMovers(rounds: Array<[number, RoundPace]>, limit = 3): Array<{ team: string; change: number }> {
    if (rounds.length < 2) return []
    const sorted = [...rounds].sort((a, b) => a[0] - b[0])
    const before = new Map(scoreTeams(sorted.slice(0, -1).map(([, r]) => r)).map(t => [t.team, t.overall]))
    return scoreTeams([sorted[sorted.length - 1][1]])
        .filter(t => before.has(t.team))
        .map(t => ({ team: t.team, change: t.overall - before.get(t.team)! }))
        .filter(t => t.change !== 0)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, limit)
}
