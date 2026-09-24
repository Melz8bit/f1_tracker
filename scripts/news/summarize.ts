// Summarize one race weekend's press coverage with Claude. Runs server-side only (the /api/news function
// or the CLI); the page reads saved JSON. Claude gets our API facts as the authority on numbers, plus the articles, and must cite
// article ids for every bullet. Quotes are checked word-for-word against the articles afterwards.
import Anthropic from '@anthropic-ai/sdk'

// Sonnet 5: accurate on facts at under half the cost of Opus (Haiku made factual errors in testing).
// Guard rails below: API data as authority, cited source ids, word-for-word quote checks.
export const MODEL = 'claude-sonnet-5'

export interface SourceArticle {
    id: number;
    site: string;
    title: string;
    url: string;
    published: string;
    text: string;
}

export interface ContractChange {
    driver: string; // Full name as written in DATA or the article
    change: string; // One sentence: what was announced
    expiry: string; // "2027", "2028+", or "" when the article doesn't say
    source: number;
}

export interface WeekendSummary {
    headline: string;
    bullets: Array<{ text: string; sources: number[] }>;
    quotes: Array<{ speaker: string; quote: string; source: number }>;
    contracts: ContractChange[];
}

const SCHEMA = {
    type: 'object',
    properties: {
        headline: { type: 'string', description: 'One sentence capturing the story of the weekend' },
        bullets: {
            type: 'array',
            description: '5 to 8 storylines, most important first',
            items: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'One or two sentences. Wrap the key driver/team name in **double asterisks**.' },
                    sources: { type: 'array', items: { type: 'integer' }, description: 'Ids of the articles this bullet draws on' },
                },
                required: ['text', 'sources'],
                additionalProperties: false,
            },
        },
        quotes: {
            type: 'array',
            description: 'Up to 4 short quotes from drivers or team members, copied exactly from an article',
            items: {
                type: 'object',
                properties: {
                    speaker: { type: 'string' },
                    quote: { type: 'string' },
                    source: { type: 'integer' },
                },
                required: ['speaker', 'quote', 'source'],
                additionalProperties: false,
            },
        },
        contracts: {
            type: 'array',
            description: 'Confirmed driver contract news: extensions, new signings, confirmed moves or retirements. Empty if none.',
            items: {
                type: 'object',
                properties: {
                    driver: { type: 'string', description: 'Driver full name' },
                    change: { type: 'string', description: 'One sentence in your own words: what was announced and by whom' },
                    expiry: { type: 'string', description: 'Final season of the deal as stated in the article, e.g. "2027" or "2028+"; empty string if not stated' },
                    source: { type: 'integer', description: 'Id of the article that reports it' },
                },
                required: ['driver', 'change', 'expiry', 'source'],
                additionalProperties: false,
            },
        },
    },
    required: ['headline', 'bullets', 'quotes', 'contracts'],
    additionalProperties: false,
}

const SYSTEM = `You write the race-weekend notes for a Formula 1 season dashboard.

You receive two things:
1. DATA: the official classification and timing facts for the weekend. This is authoritative. Every number, position, lap count, gap and penalty you write must agree with DATA. If an article disagrees with DATA, DATA is right.
2. ARTICLES: press coverage of the weekend, each with an id.

Write the storylines the data alone can't tell: why things happened, turning points, team and driver reactions, strategy calls, controversies, and off-track news from the weekend (appeals, upgrades, contracts, regulation disputes). Don't restate the classification line by line; the dashboard already shows it.

Rules:
- Every bullet cites the article ids it draws on. Only say what the articles or DATA support.
- Write in your own words. Don't copy sentences from the articles; the only verbatim text allowed is in "quotes".
- Quotes must be copied exactly, character for character, from an article, and must be something a driver, team principal or team member said. Skip quotes rather than paraphrase them.
- Neutral, factual tone. No speculation beyond what the articles report.
- "contracts" lists only announcements confirmed by the team or driver (extensions, signings, confirmed moves, retirements) — never rumours, talks or "expected" moves. Give the expiry only if the article states it; otherwise leave it empty.`

export function formatArticles(articles: SourceArticle[], maxCharsEach: number): string {
    return articles.map(a => `<article id="${a.id}" site="${a.site}" published="${a.published}">
<title>${a.title}</title>
${a.text.slice(0, maxCharsEach)}
</article>`).join('\n\n')
}

// Collapse whitespace and curly quotes so a faithful quote still matches the article text
const normalise = (s: string) => s.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()

export async function summarizeWeekend(client: Anthropic, data: string, articles: SourceArticle[]): Promise<WeekendSummary> {
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{
            role: 'user',
            content: `<data>\n${data}\n</data>\n\n<articles>\n${formatArticles(articles, 12_000)}\n</articles>`,
        }],
    })

    if (response.stop_reason === 'refusal') throw new Error(`Summary refused: ${response.stop_details?.category ?? 'unknown'}`)
    if (response.stop_reason === 'max_tokens') throw new Error('Summary hit max_tokens')
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
    const summary = JSON.parse(text) as WeekendSummary

    // Keep only citations that exist, and quotes that really appear in the cited article
    const byId = new Map(articles.map(a => [a.id, a]))
    return {
        headline: summary.headline,
        bullets: summary.bullets
            .map(b => ({ text: b.text, sources: b.sources.filter(id => byId.has(id)) }))
            .filter(b => b.sources.length > 0),
        quotes: summary.quotes.filter(q => {
            const article = byId.get(q.source)
            return article !== undefined && normalise(article.text).includes(normalise(q.quote))
        }),
        // A contract change must cite a real article, and any expiry year must appear in that article
        contracts: (summary.contracts ?? [])
            .filter(c => byId.has(c.source))
            .map(c => {
                const year = c.expiry.match(/20\d\d/)?.[0]
                return year && !byId.get(c.source)!.text.includes(year) ? { ...c, expiry: '' } : c
            }),
    }
}
