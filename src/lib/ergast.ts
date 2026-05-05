import type { Driver, Constructor, DriverStanding, ConstructorStanding, Race, RaceResult } from '../types/f1'

const BASE_URL = 'https://ergast.com/api/f1'

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
    Constructors: ErgastConstructor[];
}

interface ErgastConstructorStandingEntry {
    position: string;
    points: string;
    wins: string;
    Constructor: ErgastConstructor;
}

interface ErgastRaceResult {
    position: string;
    points: string;
    Driver: ErgastDriver;
    Constructor: ErgastConstructor;
    grid: string;
    laps: string;
    status: string;
    Time?: {time: string};
    FastestLap?: { rank: string; lap: string; Time: {time: string} }
}

interface ErgastRace {
    season: string;
    round: string;
    raceName: string;
    Circuit: { circuitId: string; circuitName: string }
    date: string;
    Results: ErgastRaceResult[];
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
    RaceTable: {
      Races: ErgastRace[]
    }
  }
}

export async function fetchDriverStandings(season: number): Promise<DriverStanding[]> {
    const data = await ergastFetch<DriverStandingsResponse>(`/${season}/driverStandings.json`)
    const entries = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
    return entries.map(entry => ({
        position: parseInt(entry.position),
        points: parseFloat(entry.points),
        wins: parseInt(entry.wins),
        driver: {
            driverId: entry.Driver.driverId,
            code: entry.Driver.code,
            permanentNumber: entry.Driver.permanentNumber,
            givenName: entry.Driver.givenName,
            familyName: entry.Driver.familyName,
            nationality: entry.Driver.nationality,
            dateOfBirth: entry.Driver.dateOfBirth,
        },
        constructor: {
            constructorId: entry.Constructors[0].constructorId,
            name: entry.Constructors[0].name,
            nationality: entry.Constructors[0].nationality,
        }
    }))
}

export async function fetchConstructorStandings(season: number): Promise<ConstructorStanding[]> {
    const data = await ergastFetch<ConstructorStandingsResponse>(`/${season}/constructorStandings.json`)
    const entries = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
    return entries.map(entry => ({
        position: parseInt(entry.position),
        points: parseFloat(entry.points),
        wins: parseInt(entry.wins),
        constructor: {
            constructorId: entry.Constructor.constructorId,
            name: entry.Constructor.name,
            nationality: entry.Constructor.nationality,
        }
    }))
}

function mapRace(race: ErgastRace): Race {
    return {
        season: parseInt(race.season),
        round: parseInt(race.round),
        raceName: race.raceName,
        circuitId: race.Circuit.circuitId,
        circuitName: race.Circuit.circuitName,
        date: race.date,
        results: race.Results.map(r => ({
            position: parseInt(r.position),
            points: parseFloat(r.points),
            grid: parseInt(r.grid),
            laps: parseInt(r.laps),
            status: r.status,
            time: r.Time?.time,
            driver: {
                driverId: r.Driver.driverId,
                code: r.Driver.code,
                permanentNumber: r.Driver.permanentNumber,
                givenName: r.Driver.givenName,
                familyName: r.Driver.familyName,
                nationality: r.Driver.nationality,
                dateOfBirth: r.Driver.dateOfBirth,
            },
            constructor: {
                constructorId: r.Constructor.constructorId,
                name: r.Constructor.name,
                nationality: r.Constructor.nationality,
            },
            fastestLap: r.FastestLap ? { 
                rank: parseInt(r.FastestLap.rank),
                lap: parseInt(r.FastestLap.lap),
                time: r.FastestLap.Time?.time
            } : undefined,
        }))
    }
}

export async function fetchRaceResults(season: number, round: number): Promise<Race> {
    const data = await ergastFetch<RaceTableResponse>(`/${season}/${round}/results.json`)
    const race = data.MRData.RaceTable.Races[0]
    if (!race) throw new Error(`No race found for ${season} round ${round}`)
    return mapRace(race)
}

export async function fetchAllRaces(season: number): Promise<Race[]> {
    const data = await ergastFetch<RaceTableResponse>(`/${season}/results.json`)
    const races = data.MRData.RaceTable.Races
    if (!races) throw new Error(`No race found for ${season}`)
    return races.map(mapRace)
}



