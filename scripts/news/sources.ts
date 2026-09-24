// News sites the pipeline reads. `summarize: false` = headlines/links only, never sent to the model
// (Crash.net's robots.txt blocks AI crawlers, so its articles aren't used as summarizer input).
export interface Source {
    id: string;
    name: string;
    feed?: { url: string; kind: 'rss' | 'atom' };
    sitemap?: string; // Dated archive for backfilling past rounds
    isF1: (url: string) => boolean;
    summarize: boolean;
}

export const SOURCES: Source[] = [
    {
        id: 'the-race',
        name: 'The Race',
        feed: { url: 'https://www.the-race.com/feed/', kind: 'rss' },
        sitemap: 'https://www.the-race.com/sitemap-posts.xml',
        isF1: url => url.includes('/formula-1/'),
        summarize: true,
    },
    {
        id: 'rn365',
        name: 'RacingNews365',
        feed: { url: 'https://racingnews365.com/feed/news.xml', kind: 'atom' },
        isF1: url => !/\/(motogp|indycar|formula-e|wec)\b/.test(url),
        summarize: true,
    },
    {
        id: 'gpfans',
        name: 'GPFans',
        feed: { url: 'https://www.gpfans.com/en/rss.xml', kind: 'rss' },
        isF1: url => url.includes('/f1-news/'),
        summarize: true,
    },
    {
        id: 'planetf1',
        name: 'PlanetF1',
        feed: { url: 'https://www.planetf1.com/rss', kind: 'rss' },
        isF1: () => true,
        summarize: true,
    },
    {
        id: 'crash',
        name: 'Crash.net',
        feed: { url: 'https://www.crash.net/rss/f1', kind: 'rss' },
        isF1: () => true,
        summarize: false,
    },
]
