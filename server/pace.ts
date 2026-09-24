// Vercel function: GET /api/pace?season=2026
//
// Returns pace ratings per round: the committed file plus rounds computed here since. When a finished
// race is at least a day old (OpenF1 data settled) and has no rating yet, it's computed in the background
// (waitUntil) and stored in Vercel Blob. One round per call; OpenF1 data only — no AI, no API cost.
//
// Bundled into api/pace.js by `npm run build:api`. Edit this file, not the bundle.
import { get, put } from '@vercel/blob'
import { waitUntil } from '@vercel/functions'
import seedJson from '../src/data/paceRatings.json'
import { PACE_DELAY_DAYS, type RoundPace, type SeasonPace } from '../src/lib/pace.ts'
import { fetchJson, jolpicaUrl, openF1Url } from '../scripts/lib/http.ts'
import { computeRound, fetchRaceTeams, fetchSessionIndex, findSessions, type PaceDeps } from '../scripts/pace/compute.ts'

const seed = seedJson as unknown as Record<string, SeasonPace | undefined>
const DAY = 24 * 60 * 60 * 1000
const LOCK_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 3
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000

interface Stored {
    rounds: Record<string, RoundPace>;
    attempts: Record<string, { count: number; last: string; reason: string }>;
    lock?: { round: number; startedAt: string };
}

const blobPath = (season: number) => `pace/${season}.json`

async function readStored(season: number): Promise<Stored> {
    const blob = await get(blobPath(season), { access: 'private' })
    if (!blob || blob.statusCode !== 200) return { rounds: {}, attempts: {} }
    return await new Response(blob.stream).json() as Stored
}

async function writeStored(season: number, stored: Stored): Promise<void> {
    await put(blobPath(season), JSON.stringify(stored), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
    })
}

const deps: PaceDeps = {
    openF1: path => fetchJson(openF1Url(path), true),
    jolpica: path => fetchJson(jolpicaUrl(path), false),
}

async function generate(season: number, round: number): Promise<void> {
    const finish = async (update: (s: Stored) => void) => {
        const latest = await readStored(season)
        update(latest)
        delete latest.lock
        await writeStored(season, latest)
    }
    try {
        const [results, index] = await Promise.all([fetchRaceTeams(deps, season), fetchSessionIndex(deps, season)])
        const race = results.get(round)
        const sessions = race && findSessions(index, race)
        if (!race || !sessions) throw new Error('no results or OpenF1 sessions yet')
        const pace = await computeRound(deps, race, sessions)
        await finish(s => { s.rounds[round] = pace; delete s.attempts[round] })
        console.log(`R${round}: pace computed for ${Object.keys(pace.gaps.quali).length} teams`)
    } catch (err) {
        const reason = (err as Error).message
        await finish(s => {
            const previous = s.attempts[round]
            s.attempts[round] = { count: (previous?.count ?? 0) + 1, last: new Date(Date.now()).toISOString(), reason }
        })
        console.warn(`R${round}: ${reason}`)
    }
}

// The oldest finished race with no rating, at least a day old, not given up on
async function dueRound(season: number, stored: Stored, now: number): Promise<number | undefined> {
    const known = new Set([...Object.keys(seed[season]?.rounds ?? {}), ...Object.keys(stored.rounds)].map(Number))
    const results = await fetchRaceTeams(deps, season)
    return [...results.values()]
        .filter(r => r.teams.size > 0 && !known.has(r.round))
        .filter(r => now >= Date.parse(`${r.date}T00:00:00Z`) + PACE_DELAY_DAYS * DAY)
        .filter(r => {
            const attempt = stored.attempts[r.round]
            return !attempt || (attempt.count < MAX_ATTEMPTS && now - Date.parse(attempt.last) > RETRY_AFTER_MS)
        })
        .sort((a, b) => a.round - b.round)[0]?.round
}

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const currentYear = new Date().getFullYear()
    const season = Number(url.searchParams.get('season') ?? currentYear)
    if (!Number.isInteger(season) || season < 2023 || season > currentYear) {
        return Response.json({ error: 'season must be between 2023 and the current year' }, { status: 400 })
    }

    const stored = await readStored(season)
    const now = Date.now()
    let computing: number | null = null
    if (stored.lock && now - Date.parse(stored.lock.startedAt) < LOCK_MS) {
        computing = stored.lock.round
    } else {
        const round = await dueRound(season, stored, now)
        if (round !== undefined) {
            stored.lock = { round, startedAt: new Date(now).toISOString() }
            await writeStored(season, stored)
            computing = round
            waitUntil(generate(season, round))
        }
    }

    return Response.json(
        { season, rounds: { ...seed[season]?.rounds, ...stored.rounds }, computing },
        { headers: { 'Cache-Control': 'no-store' } },
    )
}
