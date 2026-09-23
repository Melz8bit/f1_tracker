// Computes team pace ratings from OpenF1 timing + telemetry and writes src/data/paceRatings.json.
//
//   npm run pace                  → current season, only rounds not yet in the file
//   npm run pace -- 2026 --force  → recompute every round
//   npm run pace -- 2026 --round 14
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { jolpica, openF1 } from '../lib/api.ts'
import {
    aeroGaps, cornerGaps, fastestLapPerTeam, qualifyingGaps, raceGaps, roundGaps, straightLineGaps, toTrace,
    type CarSample, type Gaps, type Lap, type RaceControlMessage, type Stint, type Trace,
} from './metrics.ts'

const OUTPUT = join(import.meta.dirname, '..', '..', 'src', 'data', 'paceRatings.json')

export interface RoundPace {
    raceName: string;
    gaps: {
        quali: Gaps;
        race: Gaps;
        straight: Gaps;
        slowCorners: Gaps;
        highCorners: Gaps;
        aero: Gaps;
    };
    corners: { slow: number; medium: number; high: number };
    sessions: { qualifying: number; race: number };
}

interface SeasonPace {
    generatedAt: string;
    rounds: Record<string, RoundPace>;
}

// ── inputs ────────────────────────────────────────────────────────

interface JolpicaRace {
    round: string;
    raceName: string;
    date: string;
    Results?: Array<{ number: string; Constructor: { constructorId: string } }>;
}
interface JolpicaResponse { MRData: { total: string; RaceTable: { Races: JolpicaRace[] } } }

// Car number → constructorId for every completed round (Jolpica pages at 100 rows)
async function fetchResults(season: number): Promise<Map<number, JolpicaRace & { teams: Map<number, string> }>> {
    const byRound = new Map<number, JolpicaRace & { teams: Map<number, string> }>()
    let offset = 0
    let total: number
    do {
        const page = await jolpica<JolpicaResponse>(`/${season}/results.json?limit=100&offset=${offset}`)
        total = parseInt(page.MRData.total)
        for (const race of page.MRData.RaceTable.Races) {
            const round = parseInt(race.round)
            const entry = byRound.get(round) ?? { ...race, teams: new Map<number, string>() }
            for (const r of race.Results ?? []) entry.teams.set(parseInt(r.number), r.Constructor.constructorId)
            byRound.set(round, entry)
        }
        offset += 100
    } while (offset < total)
    return byRound
}

interface Meeting { meeting_key: number; date_start: string; date_end: string; is_cancelled: boolean }
interface Session { session_key: number; meeting_key: number; session_name: string }

// OpenF1 wants timestamps without a timezone suffix (treated as UTC)
const openF1Time = (ms: number) => new Date(ms).toISOString().replace('Z', '')

// ── one round ─────────────────────────────────────────────────────

async function computeRound(race: JolpicaRace & { teams: Map<number, string> }, qualifying: number, raceSession: number): Promise<RoundPace> {
    const teamOf = (n: number) => race.teams.get(n)
    const qualiLaps = await openF1<Lap[]>(`/laps?session_key=${qualifying}`)
    const raceLaps = await openF1<Lap[]>(`/laps?session_key=${raceSession}`)
    const messages = await openF1<RaceControlMessage[]>(`/race_control?session_key=${raceSession}`)
    const stints = await openF1<Stint[]>(`/stints?session_key=${raceSession}`)

    const quali = qualifyingGaps(qualiLaps, teamOf)
    const straight = straightLineGaps([qualiLaps, raceLaps], teamOf)

    // Telemetry for each team's fastest qualifying lap (one request per team)
    const traces = new Map<string, Trace>()
    for (const [team, lap] of fastestLapPerTeam(qualiLaps, teamOf)) {
        const start = Date.parse(lap.date_start!)
        const end = start + lap.lap_duration! * 1000
        const samples = await openF1<CarSample[]>(
            `/car_data?session_key=${qualifying}&driver_number=${lap.driver_number}&date>=${openF1Time(start)}&date<=${openF1Time(end)}`)
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
        sessions: { qualifying, race: raceSession },
    }
}

async function save(output: Record<string, SeasonPace>, season: number, rounds: Record<string, RoundPace>) {
    output[season] = { generatedAt: new Date().toISOString(), rounds }
    await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n')
}

// ── main ──────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2)
    const season = parseInt(args.find(a => /^\d{4}$/.test(a)) ?? String(new Date().getFullYear()))
    const force = args.includes('--force')
    const onlyRound = args.includes('--round') ? parseInt(args[args.indexOf('--round') + 1]) : undefined

    let output: Record<string, SeasonPace> = {}
    try {
        output = JSON.parse(await readFile(OUTPUT, 'utf8'))
    } catch {
        // First run
    }
    const existing = output[season]?.rounds ?? {}

    const [results, meetings, sessions] = await Promise.all([
        fetchResults(season),
        openF1<Meeting[]>(`/meetings?year=${season}`, false),
        openF1<Session[]>(`/sessions?year=${season}`, false),
    ])

    const rounds: Record<string, RoundPace> = { ...existing }
    for (const [round, race] of [...results].sort((a, b) => a[0] - b[0])) {
        if (race.teams.size === 0) continue
        if (onlyRound !== undefined && round !== onlyRound) continue
        if (!force && onlyRound === undefined && existing[round]) continue

        const meeting = meetings.find(m => !m.is_cancelled && m.date_start.slice(0, 10) <= race.date && race.date <= m.date_end.slice(0, 10))
        const inMeeting = (name: string) => sessions.find(s => s.meeting_key === meeting?.meeting_key && s.session_name === name)
        const qualifying = inMeeting('Qualifying')
        const raceSession = inMeeting('Race')
        if (!qualifying || !raceSession) {
            console.warn(`R${round} ${race.raceName}: no OpenF1 qualifying/race session, skipped`)
            continue
        }

        process.stdout.write(`R${round} ${race.raceName}… `)
        const pace = await computeRound(race, qualifying.session_key, raceSession.session_key)
        rounds[round] = pace
        console.log(`${Object.keys(pace.gaps.quali).length} teams, corners ${pace.corners.slow} slow / ${pace.corners.high} high`)
        // Save after every round so an interrupted run keeps its progress
        await save(output, season, rounds)
    }

    await save(output, season, rounds)
    console.log(`Wrote ${Object.keys(rounds).length} rounds for ${season} → src/data/paceRatings.json`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
