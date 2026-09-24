// Shape of src/data/raceNews.json, written by scripts/news (press coverage summarized offline)

export interface PressSource {
    id: number;
    site: string;
    title: string;
    url: string;
    published: string; // YYYY-MM-DD
}

export interface RoundNews {
    headline: string;
    bullets: Array<{ text: string; sources: number[] }>; // text uses **bold** markers
    quotes: Array<{ speaker: string; quote: string; source: number }>; // verified word-for-word against the article
    sources: PressSource[];
    links: Array<{ site: string; title: string; url: string; published: string }>; // headline-only sources
    generatedAt: string;
    model: string;
}

export type NewsFile = Record<string, Record<string, RoundNews | undefined> | undefined>
