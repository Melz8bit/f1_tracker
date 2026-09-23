const BASE_URL = 'https://api.openf1.org/v1'

// OpenF1 rate-limits bursts (22 parallel requests got 429s), so every call goes through one queue:
// requests start at least MIN_GAP_MS apart, and a 429 is retried with backoff.
const MIN_GAP_MS = 350
const MAX_RETRIES = 3
let nextSlot = 0

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function takeSlot() {
    const now = Date.now()
    const start = Math.max(now, nextSlot)
    nextSlot = start + MIN_GAP_MS
    await wait(start - now)
}

// API call
async function openF1Fetch<T>(path: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        await takeSlot()
        const res = await fetch(`${BASE_URL}${path}`)
        if (res.status === 429 && attempt < MAX_RETRIES) {
            await wait(1000 * 2 ** attempt)
            continue
        }
        // OpenF1 answers 404 {"detail": "No results found."} for empty result sets
        if (res.status === 404) return [] as T
        if (!res.ok) throw new Error(`Open F1 fetch failed: ${res.status}`)
        return res.json() as Promise<T>
    }
}

export interface OpenF1Meeting {
    meeting_key: number;
    meeting_name: string; // "Bahrain Grand Prix"
    location: string;
    country_name: string;
    date_start: string; // ISO datetime, UTC
    date_end: string;
    is_cancelled: boolean;
}

export interface OpenF1Session {
    session_key: number;
    meeting_key: number;
    session_name: string; // "Race", "Sprint", "Qualifying", …
    session_type: string;
    date_start: string;
    year: number;
    country_name: string;
    circuit_short_name: string;
    is_cancelled: boolean;
}

export interface OpenF1Driver {
    driver_number: number;
    broadcast_name: string;
    full_name: string;
    name_acronym: string; // Matches Jolpica's driver code
    team_name: string;
    team_colour: string;
    session_key: number;
}

export interface OpenF1Lap {
    driver_number: number;
    lap_number: number;
    lap_duration: number | null;
    session_key: number;
    st_speed: number | null;
}

export interface OpenF1RaceControl {
    date: string;
    lap_number: number | null;
    category: string; // "Flag", "SafetyCar", "Other", …
    flag: string | null; // "GREEN", "YELLOW", "RED", "CHEQUERED", …
    message: string;
    driver_number: number | null;
}

export interface OpenF1Stint {
    driver_number: number;
    stint_number: number;
    compound: string | null; // "SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"
    lap_start: number;
    lap_end: number;
}

export interface OpenF1Weather {
    date: string;
    air_temperature: number;
    track_temperature: number;
    rainfall: number; // 0 or 1
}

export interface OpenF1Overtake {
    date: string;
    overtaking_driver_number: number;
    overtaken_driver_number: number;
    position: number;
}

export async function fetchMeetings(year: number): Promise<OpenF1Meeting[]> {
    return openF1Fetch<OpenF1Meeting[]>(`/meetings?year=${year}`)
}

export async function fetchSessions(year: number): Promise<OpenF1Session[]> {
    return openF1Fetch<OpenF1Session[]>(`/sessions?year=${year}`)
}

export async function fetchDrivers(sessionKey: number): Promise<OpenF1Driver[]> {
    return openF1Fetch<OpenF1Driver[]>(`/drivers?session_key=${sessionKey}`)
}

export async function fetchAllLaps(sessionKey: number): Promise<OpenF1Lap[]> {
    return openF1Fetch<OpenF1Lap[]>(`/laps?session_key=${sessionKey}`)
}

export async function fetchRaceControl(sessionKey: number): Promise<OpenF1RaceControl[]> {
    return openF1Fetch<OpenF1RaceControl[]>(`/race_control?session_key=${sessionKey}`)
}

export async function fetchStints(sessionKey: number): Promise<OpenF1Stint[]> {
    return openF1Fetch<OpenF1Stint[]>(`/stints?session_key=${sessionKey}`)
}

export async function fetchWeather(sessionKey: number): Promise<OpenF1Weather[]> {
    return openF1Fetch<OpenF1Weather[]>(`/weather?session_key=${sessionKey}`)
}

export async function fetchOvertakes(sessionKey: number): Promise<OpenF1Overtake[]> {
    return openF1Fetch<OpenF1Overtake[]>(`/overtakes?session_key=${sessionKey}`)
}
