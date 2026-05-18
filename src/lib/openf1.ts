// import type { DriverStanding, ConstructorStanding, Race } from '../types/f1'

const BASE_URL = 'https://api.openf1.org/v1'

// API call
async function openF1Fetch<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`)
    if (!res.ok) throw new Error(`Open F1 fetch failed: ${res.status}`)
    return res.json() as Promise<T>
}

interface OpenF1Session {
    session_key: number;
    session_name: string;
    session_type: string;
    date_start: string;
    year: number;
    country_name: string;
    circuit_short_name: string;
}

interface OpenF1Driver {
    driver_number: number;
    broadcast_name: string;
    full_name: string;
    name_acronym: string;
    team_name: string;
    team_colour: string;
    session_key: number;
}

interface OpenF1Lap {
    driver_number: number;
    lap_number: number;
    lap_duration: number | null;
    session_key: number;
    st_speed: number | null;
}

interface OpenF1CarData {
    driver_number: number;
    speed: number;
    date: string;
    session_key: number;
}

interface OpenF1Interval {
    driver_number: number;
    gap_to_leader: number | null;
    interval: number | null;
    session_key: number;
}

interface OpenF1Pit {
    driver_number: number;
    lap_number: number;
    pit_duration: number | null;
    session_key: number;
}

export async function fetchSessions(year: number): Promise<OpenF1Session[]> {
    return openF1Fetch<OpenF1Session[]>(`/sessions?year=${year}`)
}

export async function fetchDrivers(sessionKey: number): Promise<OpenF1Driver[]> {
    return openF1Fetch<OpenF1Driver[]>(`/drivers?session_key=${sessionKey}`)
}

export async function fetchLaps(sessionKey: number, driverNumber: number): Promise<OpenF1Lap[]> {
    return openF1Fetch<OpenF1Lap[]>(`/laps?session_key=${sessionKey}&driver_number=${driverNumber}`)
}

export async function fetchAllLaps(sessionKey: number): Promise<OpenF1Lap[]> {
    return openF1Fetch<OpenF1Lap[]>(`/laps?session_key=${sessionKey}`)
}

export async function fetchCarData(sessionKey: number, driverNumber: number): Promise<OpenF1CarData[]> {
    return openF1Fetch<OpenF1CarData[]>(`/car_data?session_key=${sessionKey}&driver_number=${driverNumber}`)
}

export async function fetchPits(sessionKey: number): Promise<OpenF1Pit[]> {
    return openF1Fetch<OpenF1Pit[]>(`/pit?session_key=${sessionKey}`)
}