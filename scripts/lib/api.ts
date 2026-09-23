// API access for offline scripts: throttled, retried, and cached on disk so re-runs only
// fetch what's new. Only finished sessions are requested, so cached responses never go stale.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const CACHE_DIR = join(import.meta.dirname, '..', '.cache')
const MIN_GAP_MS = 400
const MAX_RETRIES = 8
const MAX_BACKOFF_MS = 60_000

let nextSlot = 0
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function takeSlot(): Promise<void> {
    const now = Date.now()
    const start = Math.max(now, nextSlot)
    nextSlot = start + MIN_GAP_MS
    await wait(start - now)
}

async function fetchJson<T>(url: string, emptyOn404: boolean): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        await takeSlot()
        const res = await fetch(url)
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
            // OpenF1 also limits requests per minute, so back off properly (honouring Retry-After)
            const retryAfter = Number(res.headers.get('retry-after')) * 1000
            const backoff = Math.min(MAX_BACKOFF_MS, retryAfter || 2000 * 2 ** attempt)
            console.warn(`  ${res.status} — waiting ${Math.round(backoff / 1000)}s`)
            await wait(backoff)
            continue
        }
        if (res.status === 404 && emptyOn404) return [] as T
        if (!res.ok) throw new Error(`${res.status} ${url}`)
        return res.json() as Promise<T>
    }
}

async function cached<T>(url: string, emptyOn404: boolean, useCache: boolean): Promise<T> {
    const file = join(CACHE_DIR, `${createHash('sha1').update(url).digest('hex')}.json`)
    if (useCache) {
        try {
            return JSON.parse(await readFile(file, 'utf8')) as T
        } catch {
            // Not cached yet
        }
    }
    const data = await fetchJson<T>(url, emptyOn404)
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(file, JSON.stringify(data))
    return data
}

// OpenF1 answers 404 for an empty result set
export function openF1<T>(path: string, useCache = true): Promise<T> {
    return cached<T>(`https://api.openf1.org/v1${path}`, true, useCache)
}

// Schedules and results change during a season, so Jolpica is never cached
export function jolpica<T>(path: string): Promise<T> {
    return fetchJson<T>(`https://api.jolpi.ca/ergast/f1${path}`, false)
}
