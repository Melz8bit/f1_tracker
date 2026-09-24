// Finds each event's power unit documents on fia.com and turns them into per-round usage.
// No disk access — shared by the CLI (scripts/fia-pu/index.ts) and the Vercel function.
import { constructorIdFromEntry, type DriverPU, type PUPenalty, type RoundPU } from '../../src/lib/powerUnits.ts'
import { allowedByRobots } from '../news/robots.ts'
import { parseNewElements, parsePenalty, parseUsageReport } from './parse.ts'

export interface CrawlDeps {
    text: (url: string) => Promise<string>;
    bytes: (url: string) => Promise<Uint8Array>;
    log: (message: string) => void;
}

const ORIGIN = 'https://www.fia.com'
const CHAMPIONSHIP = `${ORIGIN}/documents/championships/fia-formula-one-world-championship-14`

export interface FiaEvent {
    name: string; // "Spanish Grand Prix"
    url: string;
}

// The season page's event dropdown lists every event that has documents so far
export async function listEvents(deps: CrawlDeps, season: number): Promise<FiaEvent[]> {
    const landing = await deps.text(CHAMPIONSHIP)
    const seasonPath = landing.match(new RegExp(`/documents/championships/fia-formula-one-world-championship-14/season/season-${season}-\\d+`))?.[0]
    if (!seasonPath) throw new Error(`No FIA documents page for ${season}`)
    const page = await deps.text(`${ORIGIN}${seasonPath}`)
    const events = [...page.matchAll(/<option value="([^"]*\/event\/[^"]+)"[^>]*>([^<]+)</g)]
        .map(([, path, name]) => ({ name: name.trim(), url: `${ORIGIN}${path}` }))
    return events.filter((e, i) => events.findIndex(x => x.url === e.url) === i)
}

interface EventDocs {
    usage?: string;
    newElements: string[];
    penalties: string[];
}

function classify(pdfs: string[]): EventDocs {
    // Re-issued documents get a _v2 suffix; the last listed version wins
    const latest = (matches: string[]) => matches.sort()[matches.length - 1]
    return {
        usage: latest(pdfs.filter(u => /pu_elements_used_per_driver/i.test(u))),
        newElements: pdfs.filter(u => /new_pu_elements/i.test(u)),
        penalties: pdfs.filter(u => /(infringement|offence).*car_\d+.*(pu_element|power_unit)/i.test(u)),
    }
}

async function eventDocs(deps: CrawlDeps, event: FiaEvent): Promise<EventDocs> {
    const page = await deps.text(event.url)
    const pdfs = [...new Set([...page.matchAll(/href="(\/system\/files\/decision-document\/[^"]+\.pdf)"/gi)].map(m => `${ORIGIN}${m[1]}`))]
    return classify(pdfs)
}

// One event → round number + after-weekend totals + penalties. Undefined if the event has no PU report yet.
export async function readEvent(deps: CrawlDeps, event: FiaEvent): Promise<{ round: number; data: RoundPU } | undefined> {
    const docs = await eventDocs(deps, event)
    if (!docs.usage) return undefined
    const robots = (url: string) => deps.text(url)
    // One broken document shouldn't lose the whole event
    const fetchDoc = async (url: string) => {
        try {
            return (await allowedByRobots(url, robots)) ? await deps.bytes(url) : undefined
        } catch (err) {
            deps.log(`  skipped ${url}: ${(err as Error).message}`)
            return undefined
        }
    }

    const usageBytes = await fetchDoc(docs.usage)
    if (!usageBytes) return undefined
    const usage = await parseUsageReport(usageBytes)
    let round = usage.round
    const drivers = new Map<number, DriverPU>(usage.drivers.map(d => [d.car, {
        car: d.car, driver: d.driver, team: d.team, constructorId: constructorIdFromEntry(d.team), counts: { ...d.counts },
    }]))

    // Elements fitted during the weekend: the Friday report doesn't include them yet
    for (const url of docs.newElements) {
        const bytes = await fetchDoc(url)
        if (!bytes) continue
        const { round: r, changes } = await parseNewElements(bytes)
        round ??= r
        for (const c of changes) {
            const d = drivers.get(c.car)
            if (d) d.counts[c.element] = Math.max(d.counts[c.element], c.previous + 1)
        }
    }

    const penalties: PUPenalty[] = []
    for (const url of docs.penalties) {
        const bytes = await fetchDoc(url)
        const penalty = bytes && await parsePenalty(bytes)
        if (penalty) penalties.push({ ...penalty, url })
    }

    if (round === undefined) {
        deps.log(`  ${event.name}: no round number in the documents, skipped`)
        return undefined
    }
    return {
        round,
        data: {
            event: event.name,
            drivers: [...drivers.values()].sort((a, b) => a.car - b.car),
            penalties,
            sources: [docs.usage, ...docs.newElements, ...docs.penalties],
        },
    }
}
