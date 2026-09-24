// Pace ratings for one round, from OpenF1 timing + telemetry. No disk access — shared by the CLI
// (scripts/pace/index.ts, disk-cached) and the Vercel function (server/pace.ts). Fetching is injected.
import type { RoundPace } from '../../src/lib/pace.ts'
import {
    aeroGaps, cornerGaps, fastestLapPerTeam, qualifyingGaps, raceGaps, roundGaps, straightLineGaps, toTrace,
    type CarSample, type Lap, type RaceControlMessage, type Stint, type Trace,
} from './metrics.ts'

export interface PaceDeps {
    openF1: <T>(path: string) => Promise<T>;
    jolpica: <T>(path: string) => Promise<T>;
}

export interface RaceTeams {
    round: number;
    raceName: string;
    date: string;
    teams: Map<number, string>; // Car number → constructorId
}

interface JolpicaRace {
    round: string;
    raceName: string;
    date: string;
    Results?: Array<{ number: string; Constructor: { constructorId: string } }>;
}
interface JolpicaResponse { MRData: { total: string; RaceTable: { Races: JolpicaRace[] } } }

// Car number → constructorId for every completed round (Jolpica pages at 100 rows)
export async function fetchRaceTeams(deps: PaceDeps, season: number): Promise<Map<number, RaceTeams>> {
    const byRound = new Map<number, RaceTeams>()
    let offset = 0
    let total: number
    do {
        const page = await deps.jolpica<JolpicaResponse>(`/${season}/results.json?limit=100&offset=${offset}`)
        total = parseInt(page.MRData.total)
        for (const race of page.MRData.RaceTable.Races) {
            const round = parseInt(race.round)
            const entry = byRound.get(round) ?? { round, raceName: race.raceName, date: race.date, teams: new Map<number, string>() }
            for (const r of race.Results ?? []) entry.teams.set(parseInt(r.number), r.Constructor.constructorId)
            byRound.set(round, entry)
        }
        offset += 100
    } while (offset < total)
    return byRound
}

interface Meeting { meeting_key: number; date_start: string; date_end: string; is_cancelled: boolean }
interface Session { session_key: number; meeting_key: number; session_name: string }

export interface SessionIndex {
    meetings: Meeting[];
    sessions: Session[];
}

export async function fetchSessionIndex(deps: PaceDeps, season: number): Promise<SessionIndex> {
    const [meetings, sessions] = await Promise.all([
        deps.openF1<Meeting[]>(`/meetings?year=${season}`),
        deps.openF1<Session[]>(`/sessions?year=${season}`),
    ])
    return { meetings, sessions }
}

// Jolpica round → OpenF1 qualifying + race sessions (race date inside the meeting's dates)
export function findSessions(index: SessionIndex, race: RaceTeams): { qualifying: number; race: number } | undefined {
    const meeting = index.meetings.find(m => !m.is_cancelled && m.date_start.slice(0, 10) <= race.date && race.date <= m.date_end.slice(0, 10))
    const inMeeting = (name: string) => index.sessions.find(s => s.meeting_key === meeting?.meeting_key && s.session_name === name)
    const qualifying = inMeeting('Qualifying')
    const raceSession = inMeeting('Race')
    return qualifying && raceSession ? { qualifying: qualifying.session_key, race: raceSession.session_key } : undefined
}

// OpenF1 wants timestamps without a timezone suffix (treated as UTC)
const openF1Time = (ms: number) => new Date(ms).toISOString().replace('Z', '')

export async function computeRound(deps: PaceDeps, race: RaceTeams, sessions: { qualifying: number; race: number }): Promise<RoundPace> {
    const teamOf = (n: number) => race.teams.get(n)
    const qualiLaps = await deps.openF1<Lap[]>(`/laps?session_key=${sessions.qualifying}`)
    const raceLaps = await deps.openF1<Lap[]>(`/laps?session_key=${sessions.race}`)
    const messages = await deps.openF1<RaceControlMessage[]>(`/race_control?session_key=${sessions.race}`)
    const stints = await deps.openF1<Stint[]>(`/stints?session_key=${sessions.race}`)

    const quali = qualifyingGaps(qualiLaps, teamOf)
    const straight = straightLineGaps([qualiLaps, raceLaps], teamOf)

    // Telemetry for each team's fastest qualifying lap (one request per team)
    const traces = new Map<string, Trace>()
    for (const [team, lap] of fastestLapPerTeam(qualiLaps, teamOf)) {
        const start = Date.parse(lap.date_start!)
        const end = start + lap.lap_duration! * 1000
        const samples = await deps.openF1<CarSample[]>(
            `/car_data?session_key=${sessions.qualifying}&driver_number=${lap.driver_number}&date>=${openF1Time(start)}&date<=${openF1Time(end)}`)
        const trace = toTrace(samples)
        if (trace) traces.set(team, trace)
    }
    const referenceTeam = Object.entries(quali).sort((a, b) => a[1] - b[1])[0]?.[0]
    const corners = cornerGaps(traces, referenceTeam ?? '')

    return {
        raceName: race.raceName,
        gaps: {
            quali: roundGaps(quali),
            race: roundGaps(raceGaps(raceLaps, stints, messages, teamOf)),
            straight: roundGaps(straight),
            slowCorners: roundGaps(corners.slow),
            highCorners: roundGaps(corners.high),
            aero: roundGaps(aeroGaps(straight, corners.high)),
        },
        corners: corners.corners,
        sessions,
    }
}
