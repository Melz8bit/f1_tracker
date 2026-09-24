// Throttled, retrying HTTP for offline scripts and the Vercel news function. No disk access, so it
// runs anywhere; scripts/lib/api.ts layers an on-disk cache on top for local runs.

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Each queue spaces requests at least `gapMs` apart
function queue(gapMs: number) {
    let nextSlot = 0
    return async () => {
        const now = Date.now()
        const start = Math.max(now, nextSlot)
        nextSlot = start + gapMs
        await wait(start - now)
    }
}

const apiSlot = queue(400)
const pageSlot = queue(1000) // News sites: one page per second across all of them
const MAX_RETRIES = 8
const MAX_BACKOFF_MS = 60_000

export async function fetchJson<T>(url: string, emptyOn404: boolean): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        await apiSlot()
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

// Identify ourselves honestly to news sites
const USER_AGENT = 'f1-dashboard-news/1.0 (personal project; summaries with source links)'

// News sites and fia.com: one request per second, a few retries on server errors (fia.com 502s occasionally)
async function politeGet(url: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        await pageSlot()
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        if (res.status >= 500 && attempt < 3) {
            await wait(3000 * (attempt + 1))
            continue
        }
        if (!res.ok) throw new Error(`${res.status} ${url}`)
        return res
    }
}

export async function fetchPage(url: string): Promise<string> {
    return (await politeGet(url)).text()
}

// OpenF1 answers 404 for an empty result set
export const openF1Url = (path: string) => `https://api.openf1.org/v1${path}`
export const jolpicaUrl = (path: string) => `https://api.jolpi.ca/ergast/f1${path}`

// Binary download (FIA PDFs), same politeness as pages
export async function fetchBytes(url: string): Promise<Uint8Array> {
    return new Uint8Array(await (await politeGet(url)).arrayBuffer())
}
