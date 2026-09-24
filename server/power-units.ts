// Vercel function: GET /api/power-units?season=2026
//
// Returns power unit element usage per round from the FIA's documents. At most every few hours it checks
// fia.com in the background for events it hasn't read yet, plus the latest event (penalty decisions keep
// arriving during a race weekend). Plain PDF parsing — no AI, no API cost. Stored in Vercel Blob.
//
// Bundled into api/power-units.js by `npm run build:api`. Edit this file, not the bundle.
import { get, put } from '@vercel/blob'
import { waitUntil } from '@vercel/functions'
import seedJson from '../src/data/powerUnits.json'
import type { PUFile, RoundPU, SeasonPU } from '../src/lib/powerUnits.ts'
import { fetchBytes, fetchPage } from '../scripts/lib/http.ts'
import { listEvents, readEvent, type CrawlDeps } from '../scripts/fia-pu/crawl.ts'

const seed = seedJson as PUFile
const CHECK_EVERY_MS = 3 * 60 * 60 * 1000

const blobPath = (season: number) => `power-units/${season}.json`

async function readStored(season: number): Promise<SeasonPU> {
    const blob = await get(blobPath(season), { access: 'private' })
    if (!blob || blob.statusCode !== 200) return { checkedAt: new Date(0).toISOString(), rounds: {} }
    return await new Response(blob.stream).json() as SeasonPU
}

async function writeStored(season: number, stored: SeasonPU): Promise<void> {
    await put(blobPath(season), JSON.stringify(stored), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
    })
}

const deps: CrawlDeps = { text: fetchPage, bytes: fetchBytes, log: message => console.log(message) }

async function refresh(season: number): Promise<void> {
    const known = { ...seed[season]?.rounds, ...(await readStored(season)).rounds }
    const latestRound = Math.max(0, ...Object.keys(known).map(Number))
    const readNames = new Set(Object.entries(known).filter(([r]) => Number(r) !== latestRound).map(([, v]) => v.event))
    const events = (await listEvents(deps, season)).filter(e => !readNames.has(e.name))

    const found: Record<string, RoundPU> = {}
    for (const event of events) {
        const result = await readEvent(deps, event)
        if (result) found[result.round] = result.data
    }
    const latest = await readStored(season)
    await writeStored(season, { checkedAt: new Date(Date.now()).toISOString(), rounds: { ...latest.rounds, ...found } })
    console.log(`checked ${events.length} events, stored rounds ${Object.keys(found).join(', ') || 'none new'}`)
}

export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const currentYear = new Date().getFullYear()
    const season = Number(url.searchParams.get('season') ?? currentYear)
    if (!Number.isInteger(season) || season < 2026 || season > currentYear) {
        return Response.json({ error: 'season must be 2026 or later (FIA PU reports are parsed from 2026)' }, { status: 400 })
    }

    const stored = await readStored(season)
    const checkedAt = Math.max(Date.parse(stored.checkedAt), Date.parse(seed[season]?.checkedAt ?? '1970-01-01'))
    const checking = Date.now() - checkedAt > CHECK_EVERY_MS
    if (checking) {
        // Claim the check first so simultaneous visitors don't all crawl fia.com
        await writeStored(season, { ...stored, checkedAt: new Date(Date.now()).toISOString() })
        waitUntil(refresh(season).catch(err => console.error('refresh failed', err)))
    }

    return Response.json(
        { season, rounds: { ...seed[season]?.rounds, ...stored.rounds }, checking },
        { headers: { 'Cache-Control': 'no-store' } },
    )
}
