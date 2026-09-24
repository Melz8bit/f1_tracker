// API access for local scripts: the throttled fetchers from http.ts plus an on-disk cache, so re-runs
// only fetch what's new. Only finished sessions and published articles are cached, so they never go stale.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fetchJson, fetchPage, jolpicaUrl, openF1Url } from './http.ts'

const CACHE_DIR = join(import.meta.dirname, '..', '.cache')

async function cached<T>(file: string, useCache: boolean, load: () => Promise<T>, encode: (v: T) => string, decode: (s: string) => T): Promise<T> {
    if (useCache) {
        try {
            return decode(await readFile(file, 'utf8'))
        } catch {
            // Not cached yet
        }
    }
    const data = await load()
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, encode(data))
    return data
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex')

export function openF1<T>(path: string, useCache = true): Promise<T> {
    const url = openF1Url(path)
    return cached(join(CACHE_DIR, `${hash(url)}.json`), useCache, () => fetchJson<T>(url, true), JSON.stringify, s => JSON.parse(s) as T)
}

// Schedules and results change during a season, so Jolpica is never cached
export function jolpica<T>(path: string): Promise<T> {
    return fetchJson<T>(jolpicaUrl(path), false)
}

// Articles don't change once published, so pages are cached; feeds and sitemaps (`useCache` false) aren't
export function webPage(url: string, useCache = true): Promise<string> {
    return cached(join(CACHE_DIR, 'pages', `${hash(url)}.html`), useCache, () => fetchPage(url), s => s, s => s)
}
