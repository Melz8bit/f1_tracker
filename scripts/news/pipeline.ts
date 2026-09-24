// The news pipeline, shared by the local CLI (scripts/news/index.ts) and the Vercel function
// (api/news.ts). Fetching is injected so each can supply its own (disk-cached locally, plain on Vercel).
import type Anthropic from '@anthropic-ai/sdk'
import { fetchAllRaces, fetchAllSprints, fetchConstructorStandings, fetchDriverStandings, fetchPoles, fetchSchedule } from '../../src/lib/ergast.ts'
import { resultFacts, sessionFacts, type SessionData } from '../../src/lib/raceFacts.ts'
import { summaryDue, type RoundNews } from '../../src/lib/news.ts'
import type { Pole, Race, ScheduleRace } from '../../src/types/f1.ts'
import { SOURCES, type Source } from './sources.ts'
import { parseFeed, parseSitemap, type Listing } from './feeds.ts'
import { extractArticle } from './extract.ts'
import { allowedByRobots } from './robots.ts'
import { MODEL, summarizeWeekend, type SourceArticle } from './summarize.ts'

export interface PipelineDeps {
    // Fetch a web page. `fresh` = bypass any cache (feeds, sitemaps, robots.txt)
    page: (url: string, fresh?: boolean) => Promise<string>;
    openF1: <T>(path: string) => Promise<T>;
    log: (message: string) => void;
}

const DAY = 24 * 60 * 60 * 1000
const MAX_ARTICLES = 14 // Sent to the summarizer per weekend
// Keeps one site from dominating — unless it's the only coverage left (older rounds, sitemap-only)
const MAX_PER_SITE = { several: 5, single: 8 }
const MIN_ARTICLE_CHARS = 800
const MAX_LINKS = 6 // Link-only sources (not summarized)
export const MIN_ARTICLES = 2

export { summaryDue }

// ── season data ───────────────────────────────────────────────────

interface Meeting { meeting_key: number; date_start: string; date_end: string; is_cancelled: boolean }
interface Session { session_key: number; meeting_key: number; session_name: string }

export interface SeasonData {
    season: number;
    schedule: ScheduleRace[];
    races: Race[];
    sprints: Race[];
    poles: Pole[];
    meetings: Meeting[];
    sessions: Session[];
}

export async function loadSeason(deps: PipelineDeps, season: number): Promise<SeasonData> {
    const [schedule, races, sprints, poles, meetings, sessions] = await Promise.all([
        fetchSchedule(season), fetchAllRaces(season), fetchAllSprints(season), fetchPoles(season),
        deps.openF1<Meeting[]>(`/meetings?year=${season}`), deps.openF1<Session[]>(`/sessions?year=${season}`),
    ])
    return { season, schedule, races, sprints, poles, meetings, sessions }
}

// ── which articles belong to a weekend ────────────────────────────

// Thursday media day through the Wednesday after the race
export function weekendWindow(race: ScheduleRace): [number, number] {
    const start = Date.parse(`${race.firstPracticeDate ?? race.date}T00:00:00Z`) - DAY
    return [start, Date.parse(`${race.date}T00:00:00Z`) + 4 * DAY]
}

const STOP_WORDS = new Set(['grand', 'prix', 'the', 'of', 'in', 'circuit', 'international'])
const WEEKEND_WORDS = ['race', 'qualifying', 'sprint', 'pole', 'wins', 'win', 'victory', 'podium', 'penalty', 'crash', 'strategy', 'result', 'report', 'verdict', 'winners', 'losers', 'ratings']

// Rough relevance: mentions of this event, then of weekend-type topics. Title for feeds, slug for sitemaps.
function relevance(listing: Listing, race: ScheduleRace): number {
    const text = `${listing.title} ${listing.url}`.toLowerCase()
    const eventWords = [race.raceName, race.circuitName, race.locality, race.country]
        .join(' ').toLowerCase().split(/[^a-zà-ÿ]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
    let score = 0
    for (const w of new Set(eventWords)) if (text.includes(w)) score += 3
    for (const w of WEEKEND_WORDS) if (text.includes(w)) score += 1
    return score
}

function pickForWeekend(listings: Listing[], race: ScheduleRace, sources: Source[], limit: number): Listing[] {
    const [from, to] = weekendWindow(race)
    const bySite = new Map<string, number>()
    const seen = new Set<string>()
    const inWindow = listings.filter(l => {
        const source = sources.find(s => s.id === l.source)
        const at = Date.parse(l.published)
        return source !== undefined && source.isF1(l.url) && at >= from && at <= to
    })
    const perSite = new Set(inWindow.map(l => l.source)).size > 1 ? MAX_PER_SITE.several : MAX_PER_SITE.single
    return inWindow
        .map(l => ({ l, score: relevance(l, race) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.l)
        .filter(l => {
            if (seen.has(l.url)) return false
            const count = bySite.get(l.source) ?? 0
            if (count >= perSite) return false
            seen.add(l.url)
            bySite.set(l.source, count + 1)
            return true
        })
        .slice(0, limit)
}

// ── collection ────────────────────────────────────────────────────

// Every source's feed, plus dated sitemaps when a weekend is older than the feed reaches
export async function collectListings(deps: PipelineDeps, oldestNeeded: number): Promise<Listing[]> {
    const listings: Listing[] = []
    for (const source of SOURCES) {
        if (!source.feed) continue
        try {
            const items = parseFeed(await deps.page(source.feed.url, true), source)
            listings.push(...items)
            const oldest = Math.min(...items.map(i => Date.parse(i.published)).filter(Number.isFinite))
            if (source.sitemap && oldest > oldestNeeded) listings.push(...parseSitemap(await deps.page(source.sitemap, true), source))
        } catch (err) {
            deps.log(`  ${source.name}: ${(err as Error).message}`)
        }
    }
    return listings
}

async function fetchArticles(deps: PipelineDeps, picks: Listing[]): Promise<SourceArticle[]> {
    const articles: SourceArticle[] = []
    const robotsText = (url: string) => deps.page(url, true)
    for (const pick of picks) {
        if (!(await allowedByRobots(pick.url, robotsText))) continue
        try {
            const article = extractArticle(await deps.page(pick.url))
            if (article.text.length < MIN_ARTICLE_CHARS) continue
            articles.push({
                id: articles.length + 1,
                site: SOURCES.find(s => s.id === pick.source)!.name,
                title: article.title || pick.title,
                url: pick.url,
                published: (article.published || pick.published).slice(0, 10),
                text: article.text,
            })
        } catch (err) {
            deps.log(`  skipped ${pick.url}: ${(err as Error).message}`)
        }
    }
    return articles
}

// ── the DATA block (authoritative facts) ──────────────────────────

function classification(race: Race): string {
    return race.results.map(r => {
        const pos = /^\d+$/.test(r.positionText) ? `P${r.position}` : ({ R: 'DNF', W: 'DNS', D: 'DSQ', N: 'NC' }[r.positionText] ?? r.positionText)
        const extra = r.positionText === 'R' ? ` (retired lap ${r.laps}, ${r.status})` : r.time ? ` (${r.time})` : ''
        return `${pos} ${r.driver.givenName} ${r.driver.familyName} (${r.constructor.name}) grid ${r.grid === 0 ? 'pit lane' : r.grid}${extra}`
    }).join('\n')
}

async function buildData(deps: PipelineDeps, data: SeasonData, info: ScheduleRace, race: Race): Promise<string> {
    const pole = data.poles.find(p => p.round === race.round)
    const sprint = data.sprints.find(s => s.round === race.round && s.results.length > 0)
    const meeting = data.meetings.find(m => !m.is_cancelled && m.date_start.slice(0, 10) <= race.date && race.date <= m.date_end.slice(0, 10))
    const raceSession = data.sessions.find(s => s.meeting_key === meeting?.meeting_key && s.session_name === 'Race')
    let facts = resultFacts(race, pole)
    if (raceSession) {
        const key = raceSession.session_key
        const sessionData: SessionData = {
            drivers: await deps.openF1(`/drivers?session_key=${key}`),
            raceControl: await deps.openF1(`/race_control?session_key=${key}`),
            stints: await deps.openF1(`/stints?session_key=${key}`),
            weather: await deps.openF1(`/weather?session_key=${key}`),
            overtakes: await deps.openF1(`/overtakes?session_key=${key}`),
        }
        facts = [...facts, ...sessionFacts(race, sessionData)]
    }
    const [drivers, constructors] = await Promise.all([fetchDriverStandings(data.season, race.round), fetchConstructorStandings(data.season, race.round)])

    return [
        `Round ${race.round}: ${race.raceName}, ${info.circuitName} (${info.locality}, ${info.country}), race day ${race.date}`,
        pole ? `Pole: ${pole.driver.givenName} ${pole.driver.familyName} (${pole.constructor.name})` : '',
        `\nRace classification:\n${classification(race)}`,
        sprint ? `\nSprint classification:\n${classification(sprint)}` : '',
        `\nFacts:\n${facts.map(f => `- ${f.replace(/\*\*/g, '')}`).join('\n')}`,
        `\nDrivers' championship after this round: ${drivers.slice(0, 6).map(d => `${d.driver.familyName} ${d.points}`).join(', ')}`,
        `Constructors' championship after this round: ${constructors.slice(0, 6).map(c => `${c.constructor.name} ${c.points}`).join(', ')}`,
    ].filter(Boolean).join('\n')
}

// ── one weekend ───────────────────────────────────────────────────

export interface WeekendInputs {
    articles: SourceArticle[];
    links: RoundNews['links'];
    data: string;
}

// Everything the summarizer needs for one round (no Claude call yet — used by --dry-run too)
export async function prepareWeekend(deps: PipelineDeps, data: SeasonData, round: number, listings: Listing[]): Promise<WeekendInputs> {
    const race = data.races.find(r => r.round === round)
    const info = data.schedule.find(r => r.round === round)
    if (!race || !info) throw new Error(`Round ${round} has no results yet`)
    const summarizable = SOURCES.filter(s => s.summarize)
    const linkOnly = SOURCES.filter(s => !s.summarize)
    const articles = await fetchArticles(deps, pickForWeekend(listings, info, summarizable, MAX_ARTICLES))
    const links = pickForWeekend(listings, info, linkOnly, MAX_LINKS)
        .map(l => ({ site: linkOnly.find(s => s.id === l.source)!.name, title: l.title, url: l.url, published: l.published.slice(0, 10) }))
    return { articles, links, data: await buildData(deps, data, info, race) }
}

export async function summarizeRound(client: Anthropic, inputs: WeekendInputs): Promise<RoundNews> {
    const summary = await summarizeWeekend(client, inputs.data, inputs.articles)
    return {
        ...summary,
        generatedAt: new Date().toISOString(),
        model: MODEL,
        sources: inputs.articles.map(({ id, site, title, url, published }) => ({ id, site, title, url, published })),
        links: inputs.links,
    }
}
