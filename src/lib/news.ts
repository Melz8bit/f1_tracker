// Shape of src/data/raceNews.json, written by scripts/news (press coverage summarized offline)

export interface PressSource {
    id: number;
    site: string;
    title: string;
    url: string;
    published: string; // YYYY-MM-DD
}

export interface ContractNews {
    driverId: string;
    change: string;
    expiry: string; // "2027", "2028+", or "" when not stated
    url: string;
    site: string;
    published: string; // YYYY-MM-DD
}

export interface RoundNews {
    headline: string;
    bullets: Array<{ text: string; sources: number[] }>; // text uses **bold** markers
    quotes: Array<{ speaker: string; quote: string; source: number }>; // verified word-for-word against the article
    sources: PressSource[];
    links: Array<{ site: string; title: string; url: string; published: string }>; // headline-only sources
    contracts?: ContractNews[]; // Confirmed contract announcements found in this round's coverage
    generatedAt: string;
    model: string;
}

export type NewsFile = Record<string, Record<string, RoundNews | undefined> | undefined>

const DAY = 24 * 60 * 60 * 1000

// Analysis pieces ("everything we learned", "winners and losers") land a day or two after the race,
// so a weekend is only summarized once this long after race day. It's never redone afterwards.
export const SUMMARY_DELAY_DAYS = 2

export function summaryDue(race: { date: string }, now = Date.now()): boolean {
    return now >= Date.parse(`${race.date}T00:00:00Z`) + SUMMARY_DELAY_DAYS * DAY
}
