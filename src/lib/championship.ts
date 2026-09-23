// Championship math: points on offer and who can still win the title.

interface PointsSystem {
    race: number[]; // Points by finishing position, P1 first
    sprint: number[];
    fastestLap: number; // Bonus point for fastest lap in the top 10 (2019–2024 only)
}

export function pointsSystem(season: number): PointsSystem {
    return {
        race: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
        sprint: season >= 2022 ? [8, 7, 6, 5, 4, 3, 2, 1] : season === 2021 ? [3, 2, 1] : [],
        fastestLap: season >= 2019 && season <= 2024 ? 1 : 0,
    }
}

export interface MaxRemaining {
    drivers: number;
    constructors: number; // A 1-2 finish every time
}

export function maxRemainingPoints(season: number, racesLeft: number, sprintsLeft: number): MaxRemaining {
    const { race, sprint, fastestLap } = pointsSystem(season)
    const sprintWin = sprint[0] ?? 0
    const sprintOneTwo = sprintWin + (sprint[1] ?? 0)
    return {
        drivers: racesLeft * (race[0] + fastestLap) + sprintsLeft * sprintWin,
        constructors: racesLeft * (race[0] + race[1] + fastestLap) + sprintsLeft * sprintOneTwo,
    }
}

export type TitleStatus = 'champion' | 'fight' | 'unlikely' | 'eliminated'

// Beyond this share of the remaining points, a comeback is treated as "very unlikely".
// Constructors need a 1-2 every weekend to hit their max, so their bar is lower.
const UNLIKELY_SHARE = { drivers: 0.5, constructors: 0.4 }

export function titleStatus(
    points: number,
    leaderPoints: number,
    runnerUpPoints: number,
    maxRemaining: number,
    kind: 'drivers' | 'constructors',
): TitleStatus {
    const isLeader = points === leaderPoints
    if (isLeader) return leaderPoints - runnerUpPoints > maxRemaining ? 'champion' : 'fight'
    const gap = leaderPoints - points
    if (gap > maxRemaining) return 'eliminated'
    if (gap > maxRemaining * UNLIKELY_SHARE[kind]) return 'unlikely'
    return 'fight'
}

export const TITLE_PILL: Record<TitleStatus, { label: string; className: string }> = {
    champion:   { label: 'Champion',     className: 'title-pill pill-yes' },
    fight:      { label: 'In the fight', className: 'title-pill pill-yes' },
    unlikely:   { label: 'Unlikely',     className: 'title-pill pill-math' },
    eliminated: { label: 'Eliminated',   className: 'title-pill pill-no' },
}

// Zone headers in the drivers' table
export const TITLE_ZONE: Record<TitleStatus, string> = {
    champion:   'Champion',
    fight:      'Championship fight',
    unlikely:   'Outside chance',
    eliminated: 'Eliminated',
}
