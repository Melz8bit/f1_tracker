// Pull readable article text out of a news page: drop scripts and page chrome, prefer the <article>
// element, and keep only paragraphs that read like prose.

export interface Article {
    title: string;
    published: string;
    text: string;
}

const decode = (s: string) => s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

const CHROME = /<(script|style|noscript|svg|nav|header|footer|aside|form|figure|iframe)\b[\s\S]*?<\/\1>/gi

function isProse(p: string): boolean {
    const words = p.split(/\s+/).length
    const letters = (p.match(/[A-Za-z]/g) ?? []).length
    return p.length >= 60 && words >= 10 && letters / p.length > 0.7 && !/[{};]|function\(|var /.test(p)
}

export function extractArticle(html: string): Article {
    const title = decode(html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1]
        ?? html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '').trim()
    const published = html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1]
        ?? html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/)?.[1] ?? ''

    let body = html.replace(CHROME, ' ')
    const articles = [...body.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map(m => m[0])
    if (articles.length) body = articles.sort((a, b) => b.length - a.length)[0]

    const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
        .map(m => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
        .filter(isProse)
    return { title, published, text: [...new Set(paragraphs)].join('\n\n') }
}
