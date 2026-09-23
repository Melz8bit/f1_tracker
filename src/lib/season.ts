import type { Race, ScheduleRace } from '../types/f1'

export interface SeasonState {
    totalRounds: number;
    roundsDone: number; // Grands Prix with results
    asOfRound: number; // roundsDone, or earlier if the round filter looks back in time
    isLatest: boolean; // asOfRound === roundsDone
    latest?: ScheduleRace; // Round asOfRound
    next?: ScheduleRace; // First round after asOfRound
    racesLeft: number;
    sprintsLeft: number;
}

export function buildSeasonState(
    schedule: ScheduleRace[],
    races: Race[],
    sprints: Race[],
    roundFilterMax: number,
): SeasonState {
    const roundsDone = races.reduce((max, r) => (r.results.length > 0 ? Math.max(max, r.round) : max), 0)
    const asOfRound = Math.min(Math.max(roundFilterMax, 0), roundsDone)
    const isLatest = asOfRound === roundsDone
    const sprintsRun = new Set(sprints.filter(s => s.results.length > 0).map(s => s.round))
    const ahead = schedule.filter(r => r.round > asOfRound)

    return {
        totalRounds: schedule.length,
        roundsDone,
        asOfRound,
        isLatest,
        latest: schedule.find(r => r.round === asOfRound),
        next: ahead[0],
        racesLeft: ahead.length,
        // Viewing the present mid-weekend: a sprint already run is in the standings, so it's not "left"
        sprintsLeft: ahead.filter(r => r.sprintDate && !(isLatest && sprintsRun.has(r.round))).length,
    }
}

const DAY_MS = 24 * 60 * 60 * 1000

// Fri–Sun of any scheduled weekend (plus the Monday, for late result amendments)
export function isRaceWeekend(schedule: ScheduleRace[], now = new Date()): boolean {
    return schedule.some(r => {
        const start = new Date(`${r.firstPracticeDate ?? r.date}T00:00:00Z`).getTime()
        const end = new Date(`${r.date}T00:00:00Z`).getTime() + 2 * DAY_MS
        return now.getTime() >= start && now.getTime() < end
    })
}
