// Scrapes race-weekend press coverage and summarizes it into src/data/raceNews.json.
//
//   npm run news                      → current season, rounds not yet in the file
//   npm run news -- 2026 --round 14   → one round (re-generates it)
//   npm run news -- 2026 --force      → every completed round
//   npm run news -- --dry-run         → collect + extract only; prints what would be sent (no API key needed)
//
// Needs ANTHROPIC_API_KEY (read from .env.local) unless --dry-run.
import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { openF1, webPage } from '../lib/api.ts'
import { fetchAllRaces, fetchAllSprints, fetchDriverStandings, fetchConstructorStandings, fetchPoles, fetchSchedule } from '../../src/lib/ergast.ts'
import { resultFacts, sessionFacts, type SessionData } from '../../src/lib/raceFacts.ts'
import type { Pole, Race, ScheduleRace } from '../../src/types/f1.ts'
import { SOURCES, type Source } from './sources.ts'
import { parseFeed, parseSitemap, type Listing } from './feeds.ts'
import { extractArticle } from './extract.ts'
import { allowedByRobots } from './robots.ts'
import type { RoundNews } from '../../src/lib/news.ts'
import { MODEL, formatArticles, summarizeWeekend, type SourceArticle } from './summarize.ts'

const OUTPUT = join(import.meta.dirname, '..', '..', 'src', 'data', 'raceNews.json')
const DAY = 24 * 60 * 60 * 1000
const MAX_ARTICLES = 14 // Sent to the summarizer per weekend
// Keeps one site from dominating — unless it's the only coverage left (older rounds, sitemap-only)
const MAX_PER_SITE = { several: 5, single: 8 }
const MIN_ARTICLE_CHARS = 800
const MAX_LINKS = 6 // Link-only sources (not summarized)

type NewsFile = Record<string, Record<string, RoundNews>>

// ── which articles belong to a weekend ────────────────────────────

// Thursday media day through the Wednesday after the race
function weekendWindow(race: ScheduleRace): [number, number] {
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

async function collectListings(oldestNeeded: number): Promise<Listing[]> {
    const listings: Listing[] = []
    for (const source of SOURCES) {
        if (source.feed) {
            try {
                const items = parseFeed(await webPage(source.feed.url, false), source)
                listings.push(...items)
                const oldest = Math.min(...items.map(i => Date.parse(i.published)).filter(Number.isFinite))
                // The feed only reaches back a few days; use the dated sitemap for anything older
                if (source.sitemap && oldest > oldestNeeded) listings.push(...parseSitemap(await webPage(source.sitemap, false), source))
            } catch (err) {
                console.warn(`  ${source.name}: ${(err as Error).message}`)
            }
        }
    }
    return listings
}

async function fetchArticles(picks: Listing[]): Promise<SourceArticle[]> {
    const articles: SourceArticle[] = []
    for (const pick of picks) {
        if (!(await allowedByRobots(pick.url))) continue
        try {
            const article = extractArticle(await webPage(pick.url))
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
            console.warn(`  skipped ${pick.url}: ${(err as Error).message}`)
        }
    }
    return articles
}

// ── the DATA block (authoritative facts) ──────────────────────────

interface Meeting { meeting_key: number; date_start: string; date_end: string; is_cancelled: boolean }
interface Session { session_key: number; meeting_key: number; session_name: string }

function classification(race: Race): string {
    return race.results.map(r => {
        const pos = /^\d+$/.test(r.positionText) ? `P${r.position}` : ({ R: 'DNF', W: 'DNS', D: 'DSQ', N: 'NC' }[r.positionText] ?? r.positionText)
        const extra = r.positionText === 'R' ? ` (retired lap ${r.laps}, ${r.status})` : r.time ? ` (${r.time})` : ''
        return `${pos} ${r.driver.givenName} ${r.driver.familyName} (${r.constructor.name}) grid ${r.grid === 0 ? 'pit lane' : r.grid}${extra}`
    }).join('\n')
}

async function buildData(
    season: number, info: ScheduleRace, race: Race, sprint: Race | undefined, pole: Pole | undefined,
    meetings: Meeting[], sessions: Session[],
): Promise<string> {
    const meeting = meetings.find(m => !m.is_cancelled && m.date_start.slice(0, 10) <= race.date && race.date <= m.date_end.slice(0, 10))
    const raceSession = sessions.find(s => s.meeting_key === meeting?.meeting_key && s.session_name === 'Race')
    let facts = resultFacts(race, pole)
    if (raceSession) {
        const key = raceSession.session_key
        const sessionData: SessionData = {
            drivers: await openF1(`/drivers?session_key=${key}`),
            raceControl: await openF1(`/race_control?session_key=${key}`),
            stints: await openF1(`/stints?session_key=${key}`),
            weather: await openF1(`/weather?session_key=${key}`),
            overtakes: await openF1(`/overtakes?session_key=${key}`),
        }
        facts = [...facts, ...sessionFacts(race, sessionData)]
    }
    const [drivers, constructors] = await Promise.all([fetchDriverStandings(season, race.round), fetchConstructorStandings(season, race.round)])

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

// ── main ──────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2)
    const season = parseInt(args.find(a => /^\d{4}$/.test(a)) ?? String(new Date().getFullYear()))
    const force = args.includes('--force')
    const dryRun = args.includes('--dry-run')
    const onlyRound = args.includes('--round') ? parseInt(args[args.indexOf('--round') + 1]) : undefined

    let output: NewsFile = {}
    try {
        output = JSON.parse(await readFile(OUTPUT, 'utf8'))
    } catch {
        // First run
    }
    const existing = output[season] ?? {}

    const [schedule, races, sprints, poles, meetings, sessions] = await Promise.all([
        fetchSchedule(season), fetchAllRaces(season), fetchAllSprints(season), fetchPoles(season),
        openF1<Meeting[]>(`/meetings?year=${season}`, false), openF1<Session[]>(`/sessions?year=${season}`, false),
    ])
    const todo = races
        .filter(r => r.results.length > 0)
        .filter(r => (onlyRound !== undefined ? r.round === onlyRound : force || !existing[r.round]))
        .sort((a, b) => a.round - b.round)
    if (!todo.length) {
        console.log('Nothing to do — every completed round already has news. Use --round N or --force to regenerate.')
        return
    }

    const infos = new Map(schedule.map(r => [r.round, r]))
    const oldestNeeded = Math.min(...todo.map(r => weekendWindow(infos.get(r.round)!)[0]))
    console.log(`Collecting listings from ${SOURCES.length} sites…`)
    const listings = await collectListings(oldestNeeded)
    const client = dryRun ? undefined : new Anthropic()
    const rounds: Record<string, RoundNews> = { ...existing }

    for (const race of todo) {
        const info = infos.get(race.round)!
        const summarizable = SOURCES.filter(s => s.summarize)
        const linkOnly = SOURCES.filter(s => !s.summarize)
        const picks = pickForWeekend(listings, info, summarizable, MAX_ARTICLES)
        const articles = await fetchArticles(picks)
        const links = pickForWeekend(listings, info, linkOnly, MAX_LINKS)
            .map(l => ({ site: linkOnly.find(s => s.id === l.source)!.name, title: l.title, url: l.url, published: l.published.slice(0, 10) }))
        console.log(`R${race.round} ${race.raceName}: ${articles.length} articles (${[...new Set(articles.map(a => a.site))].join(', ') || 'none'}), ${links.length} links`)

        const data = await buildData(season, info, race, sprints.find(s => s.round === race.round && s.results.length > 0), poles.find(p => p.round === race.round), meetings, sessions)
        if (dryRun) {
            for (const a of articles) console.log(`   [${a.id}] ${a.site} ${a.published} ${a.text.length} chars — ${a.title}`)
            console.log(`   prompt ≈ ${Math.round((data.length + formatArticles(articles, 12_000).length) / 4)} tokens`)
            continue
        }
        if (articles.length < 2) {
            console.warn('   too little coverage found, skipped')
            continue
        }

        const summary = await summarizeWeekend(client!, data, articles)
        rounds[race.round] = {
            ...summary,
            generatedAt: new Date().toISOString(),
            model: MODEL,
            sources: articles.map(({ id, site, title, url, published }) => ({ id, site, title, url, published })),
            links,
        }
        console.log(`   ${summary.bullets.length} bullets, ${summary.quotes.length} verified quotes`)
        // Save after every round so an interrupted run keeps its progress
        output[season] = rounds
        await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n')
    }
    if (!dryRun) console.log(`Wrote ${Object.keys(rounds).length} rounds for ${season} → src/data/raceNews.json`)
}

main().catch(err => {
    if (err instanceof Anthropic.AuthenticationError) console.error('Anthropic API key missing or invalid — add ANTHROPIC_API_KEY to .env.local')
    else console.error(err)
    process.exit(1)
})
