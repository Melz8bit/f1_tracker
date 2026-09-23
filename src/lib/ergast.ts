import type { DriverStanding, ConstructorStanding, Race, RaceResult, ScheduleRace, Driver, Constructor, Pole } from '../types/f1'

const BASE_URL = 'https://api.jolpi.ca/ergast/f1'

// Jolpica caps every response at 100 rows, whatever `limit` asks for
const PAGE_SIZE = 100

interface ErgastDriver {
    driverId: string;
    permanentNumber: string;
    code: string;
    givenName: string;
    familyName: string;
    nationality: string;
    dateOfBirth: string;
}

interface ErgastConstructor {
    constructorId: string;
    name: string;
    nationality: string;
}

interface ErgastDriverStandingEntry {
    position: string;
    points: string;
    wins: string;
    Driver: ErgastDriver;
    Constructors: ErgastConstructor[]; // Every team driven for this season, oldest first
}

interface ErgastConstructorStandingEntry {
    position: string;
    points: string;
    wins: string;
    Constructor: ErgastConstructor;
}

interface ErgastRaceResult {
    position: string;
    positionText: string;
    points: string;
    Driver: ErgastDriver;
    Constructor: ErgastConstructor;
    grid: string;
    laps: string;
    status: string;
    Time?: {time: string};
    FastestLap?: { rank: string; lap: string; Time: {time: string} }
}

interface ErgastQualifyingResult {
    position: string;
    Driver: ErgastDriver;
    Constructor: ErgastConstructor;
}

interface ErgastRace {
    season: string;
    round: string;
    raceName: string;
    Circuit: {
        circuitId: string;
        circuitName: string;
        Location: { locality: string; country: string }
    }
    date: string;
    FirstPractice?: { date: string };
    Sprint?: { date: string };
    Results?: ErgastRaceResult[];
    SprintResults?: ErgastRaceResult[];
    QualifyingResults?: ErgastQualifyingResult[];
}

// API call
async function ergastFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`)
    if (!res.ok) throw new Error(`Ergast fetch failed: ${res.status}`)
    return res.json() as Promise<T>
}


// Allows us to provide a cleaner call to the API without sending the whole T
interface DriverStandingsResponse {
    MRData: {
        StandingsTable: {
            StandingsLists: Array<{ DriverStandings: ErgastDriverStandingEntry[] }>
        }
    }
}

interface ConstructorStandingsResponse {
    MRData: {
        StandingsTable: {
            StandingsLists: Array<{ ConstructorStandings: ErgastConstructorStandingEntry[] }>
        }
    }
}

interface RaceTableResponse {
  MRData: {
    total: string;
    RaceTable: {
      Races: ErgastRace[]
    }
  }
}

// Results endpoints are paged by result row, not by race, so one race can be split across two
// pages. Fetch every page and stitch split races back together by round.
async function fetchAllRacePages(path: string): Promise<ErgastRace[]> {
    const byRound = new Map<string, ErgastRace>()
    let offset = 0
    let total: number
    do {
        const data = await ergastFetch<RaceTableResponse>(`${path}?limit=${PAGE_SIZE}&offset=${offset}`)
        total = parseInt(data.MRData.total)
        for (const race of data.MRData.RaceTable.Races) {
            const existing = byRound.get(race.round)
            if (!existing) {
                byRound.set(race.round, race)
                continue
            }
            existing.Results = [...(existing.Results ?? []), ...(race.Results ?? [])]
            existing.SprintResults = [...(existing.SprintResults ?? []), ...(race.SprintResults ?? [])]
            existing.QualifyingResults = [...(existing.QualifyingResults ?? []), ...(race.QualifyingResults ?? [])]
        }
        offset += PAGE_SIZE
    } while (offset < total)
    return [...byRound.values()]
}

function mapDriver(d: ErgastDriver): Driver {
    return {
        driverId: d.driverId,
        code: d.code,
        permanentNumber: d.permanentNumber,
        givenName: d.givenName,
        familyName: d.familyName,
        nationality: d.nationality,
        dateOfBirth: d.dateOfBirth,
    }
}

function mapConstructor(c: ErgastConstructor): Constructor {
    return {
        constructorId: c.constructorId,
        name: c.name,
        nationality: c.nationality,
    }
}

function mapResult(r: ErgastRaceResult): RaceResult {
    return {
        position: parseInt(r.position),
        positionText: r.positionText,
        points: parseFloat(r.points),
        grid: parseInt(r.grid),
        laps: parseInt(r.laps),
        status: r.status,
        time: r.Time?.time,
        driver: mapDriver(r.Driver),
        constructor: mapConstructor(r.Constructor),
        fastestLap: r.FastestLap ? {
            rank: parseInt(r.FastestLap.rank),
            lap: parseInt(r.FastestLap.lap),
            time: r.FastestLap.Time?.time
        } : undefined,
    }
}

function mapRace(race: ErgastRace, results: ErgastRaceResult[] = race.Results ?? []): Race {
    return {
        season: parseInt(race.season),
        round: parseInt(race.round),
        raceName: race.raceName,
        circuitId: race.Circuit.circuitId,
        circuitName: race.Circuit.circuitName,
        date: race.date,
        results: results.map(mapResult),
    }
}

// `round` omitted = latest standings (includes a sprint already run this weekend)
function standingsPath(season: number, round: number | undefined, kind: string): string {
    return round ? `/${season}/${round}/${kind}.json` : `/${season}/${kind}.json`
}

export async function fetchDriverStandings(season: number, round?: number): Promise<DriverStanding[]> {
    const data = await ergastFetch<DriverStandingsResponse>(standingsPath(season, round, 'driverStandings'))
    const entries = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
    return entries.map(entry => ({
        position: parseInt(entry.position),
        points: parseFloat(entry.points),
        wins: parseInt(entry.wins),
        driver: mapDriver(entry.Driver),
        // Last entry = current team (e.g. a mid-season promotion from Racing Bulls to Red Bull)
        constructor: mapConstructor(entry.Constructors[entry.Constructors.length - 1]),
    }))
}

export async function fetchConstructorStandings(season: number, round?: number): Promise<ConstructorStanding[]> {
    const data = await ergastFetch<ConstructorStandingsResponse>(standingsPath(season, round, 'constructorStandings'))
    const entries = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
    return entries.map(entry => ({
        position: parseInt(entry.position),
        points: parseFloat(entry.points),
        wins: parseInt(entry.wins),
        constructor: mapConstructor(entry.Constructor),
    }))
}

export async function fetchSchedule(season: number): Promise<ScheduleRace[]> {
    const data = await ergastFetch<RaceTableResponse>(`/${season}.json?limit=${PAGE_SIZE}`)
    return data.MRData.RaceTable.Races.map(race => ({
        season: parseInt(race.season),
        round: parseInt(race.round),
        raceName: race.raceName,
        circuitId: race.Circuit.circuitId,
        circuitName: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
        date: race.date,
        firstPracticeDate: race.FirstPractice?.date,
        sprintDate: race.Sprint?.date,
    }))
}

export async function fetchRaceResults(season: number, round: number): Promise<Race> {
    const data = await ergastFetch<RaceTableResponse>(`/${season}/${round}/results.json`)
    const race = data.MRData.RaceTable.Races[0]
    if (!race) throw new Error(`No race found for ${season} round ${round}`)
    return mapRace(race)
}

export async function fetchAllRaces(season: number): Promise<Race[]> {
    const races = await fetchAllRacePages(`/${season}/results.json`)
    return races.map(race => mapRace(race))
}

export async function fetchAllSprints(season: number): Promise<Race[]> {
    const sprints = await fetchAllRacePages(`/${season}/sprint.json`)
    return sprints.map(race => mapRace(race, race.SprintResults ?? []))
}

// Fastest qualifier per round (the pole-sitter, even if a grid penalty moved them back)
export async function fetchPoles(season: number): Promise<Pole[]> {
    const races = await fetchAllRacePages(`/${season}/qualifying.json`)
    return races.flatMap(race => {
        const pole = race.QualifyingResults?.find(q => q.position === '1')
        return pole ? [{ round: parseInt(race.round), driver: mapDriver(pole.Driver), constructor: mapConstructor(pole.Constructor) }] : []
    })
}
