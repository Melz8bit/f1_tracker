// Vercel function: GET /api/news?season=2026
//
// Returns every race-weekend press summary for the season, and — when a completed race is due and has
// no summary yet — starts summarizing it in the background (waitUntil), so the next page load has it.
// Each race is summarized once and stored in Vercel Blob; page loads only ever read.
//
// Bundled into api/news.js by `npm run build:api` (rolldown). Edit this file, not the bundle.
// Env: ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN (added when a Blob store is connected to the project).
import Anthropic from '@anthropic-ai/sdk'
import { get, put } from '@vercel/blob'
import { waitUntil } from '@vercel/functions'
import seedJson from '../src/data/raceNews.json'
import { fetchSchedule } from '../src/lib/ergast.ts'
import type { NewsFile, RoundNews } from '../src/lib/news.ts'
import { fetchJson, fetchPage, openF1Url } from '../scripts/lib/http.ts'
import { MIN_ARTICLES, collectListings, loadSeason, prepareWeekend, summarizeRound, summaryDue, weekendWindow, type PipelineDeps } from '../scripts/news/pipeline.ts'

// Summaries committed to the repo (R14 onward was the starting point). Rounds before the newest one
// here are never auto-generated — earlier races keep their hand-written notes.
const seed = seedJson as NewsFile

const MAX_ATTEMPTS = 3 // Per round, e.g. when coverage is too thin
const RETRY_AFTER_MS = 12 * 60 * 60 * 1000
const LOCK_MS = 10 * 60 * 1000 // A generation in progress; others don't start a second one

interface Stored {
    rounds: Record<string, RoundNews>;
    attempts: Record<string, { count: number; last: string; reason: string }>;
    lock?: { round: number; startedAt: string };
}

const blobPath = (season: number) => `race-news/${season}.json`

async function readStored(season: number): Promise<Stored> {
    const blob = await get(blobPath(season), { access: 'private' })
    if (!blob || blob.statusCode !== 200) return { rounds: {}, attempts: {} }
    return await new Response(blob.stream).json() as Stored
}

async function writeStored(season: number, stored: Stored): Promise<void> {
    await put(blobPath(season), JSON.stringify(stored), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
    })
}

const deps: PipelineDeps = {
    page: url => fetchPage(url),
    openF1: path => fetchJson(openF1Url(path), true),
    log: message => console.log(message),
}

// The oldest race that's finished, past the summary delay, newer than the committed summaries,
// not yet summarized, and not given up on
async function dueRound(season: number, stored: Stored, now: number): Promise<number | undefined> {
    const seeded = Object.keys(seed[season] ?? {}).map(Number)
    const firstAuto = seeded.length ? Math.max(...seeded) + 1 : 1
    const schedule = await fetchSchedule(season)
    return schedule
        .filter(r => r.round >= firstAuto && summaryDue(r, now))
        .filter(r => !stored.rounds[r.round] && !seed[season]?.[r.round])
        .filter(r => {
            const attempt = stored.attempts[r.round]
            return !attempt || (attempt.count < MAX_ATTEMPTS && now - Date.parse(attempt.last) > RETRY_AFTER_MS)
        })
        .map(r => r.round)[0]
}

async function generate(season: number, round: number): Promise<void> {
    const recordFailure = async (reason: string) => {
        const latest = await readStored(season)
        const previous = latest.attempts[round]
        latest.attempts[round] = { count: (previous?.count ?? 0) + 1, last: new Date().toISOString(), reason }
        delete latest.lock
        await writeStored(season, latest)
        console.warn(`R${round}: ${reason}`)
    }
    try {
        const data = await loadSeason(deps, season)
        if (!data.races.some(r => r.round === round && r.results.length > 0)) return await recordFailure('no results yet')
        const info = data.schedule.find(r => r.round === round)!
        const listings = await collectListings(deps, weekendWindow(info)[0])
        const inputs = await prepareWeekend(deps, data, round, listings)
        if (inputs.articles.length < MIN_ARTICLES) return await recordFailure(`only ${inputs.articles.length} articles found`)

        const news = await summarizeRound(new Anthropic(), inputs)
        const latest = await readStored(season)
        latest.rounds[round] = news
        delete latest.attempts[round]
        delete latest.lock
        await writeStored(season, latest)
        console.log(`R${round}: summarized ${inputs.articles.length} articles`)
    } catch (err) {
        await recordFailure((err as Error).message)
    }
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
    let generating: number | null = null

    const locked = stored.lock && now - Date.parse(stored.lock.startedAt) < LOCK_MS
    if (locked) {
        generating = stored.lock!.round
    } else {
        const round = await dueRound(season, stored, now)
        if (round !== undefined) {
            stored.lock = { round, startedAt: new Date(now).toISOString() }
            await writeStored(season, stored)
            generating = round
            // Keeps running after the response is sent, up to the function's maxDuration
            waitUntil(generate(season, round))
        }
    }

    return Response.json(
        { season, rounds: { ...seed[season], ...stored.rounds }, generating },
        { headers: { 'Cache-Control': 'no-store' } },
    )
}
