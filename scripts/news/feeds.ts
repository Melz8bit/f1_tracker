// Minimal RSS / Atom / sitemap readers. These formats are simple and stable enough that a regex
// pass is more robust than pulling in an XML dependency.
import type { Source } from './sources.ts'

export interface Listing {
    source: string;
    url: string;
    title: string;
    published: string; // ISO date-time
}

const decode = (s: string) => s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .trim()

const tag = (block: string, name: string) => decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '')

const toIso = (date: string) => {
    const ms = Date.parse(date)
    return Number.isNaN(ms) ? '' : new Date(ms).toISOString()
}

export function parseFeed(xml: string, source: Source): Listing[] {
    if (source.feed?.kind === 'atom') {
        return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => ({
            source: source.id,
            url: entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? '',
            title: tag(entry, 'title'),
            published: toIso(tag(entry, 'published') || tag(entry, 'updated')),
        }))
    }
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
        source: source.id,
        url: tag(item, 'link'),
        title: tag(item, 'title'),
        published: toIso(tag(item, 'pubDate')),
    }))
}

// Sitemaps carry lastmod, not the publish date; close enough to place an article in a race week
export function parseSitemap(xml: string, source: Source): Listing[] {
    return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) => {
        const url = tag(entry, 'loc')
        const slug = url.split('/').filter(Boolean).pop() ?? ''
        return { source: source.id, url, title: slug.replace(/-/g, ' '), published: toIso(tag(entry, 'lastmod')) }
    })
}
