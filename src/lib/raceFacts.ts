// Auto-generated race bullets. Text uses **bold** markers, rendered by <RichText>.
import type { Pole, Race, RaceResult } from '../types/f1'
import type { OpenF1Driver, OpenF1Overtake, OpenF1RaceControl, OpenF1Stint, OpenF1Weather } from './openf1'

const isClassified = (r: RaceResult) => /^\d+$/.test(r.positionText)

// Where a driver started. Jolpica uses grid 0 for a pit-lane start (sometimes the last grid slot instead)
function startLabel(r: RaceResult): string {
    return r.grid === 0 ? 'the pit lane' : `P${r.grid}`
}

function startPosition(r: RaceResult, fieldSize: number): number {
    return r.grid === 0 ? fieldSize : r.grid
}

// Facts that need only Jolpica results — available for every season
export function resultFacts(race: Race, pole: Pole | undefined): string[] {
    const facts: string[] = []
    const results = race.results
    const winner = results.find(r => r.position === 1)
    if (!winner) return facts
    const second = results.find(r => r.position === 2)

    const from = winner.grid === 1 ? 'pole' : startLabel(winner)
    const margin = second?.time?.startsWith('+') ? ` by ${second.time.slice(1)}s over ${second.driver.familyName}` : ''
    facts.push(`**${winner.driver.familyName}** won from ${from}${margin}.`)

    if (pole && pole.driver.driverId !== winner.driver.driverId) {
        const poleResult = results.find(r => r.driver.driverId === pole.driver.driverId)
        if (poleResult) {
            const penalty = poleResult.grid !== 1 ? ` after starting ${startLabel(poleResult)}` : ''
            const finish = isClassified(poleResult) ? `finished P${poleResult.position}` : 'did not finish'
            facts.push(`Pole-sitter **${pole.driver.familyName}** ${finish}${penalty}.`)
        }
    }

    const gainer = results
        .filter(isClassified)
        .map(r => ({ r, gain: startPosition(r, results.length) - r.position }))
        .sort((a, b) => b.gain - a.gain)[0]
    if (gainer && gainer.gain >= 3) {
        facts.push(`Biggest gainer: **${gainer.r.driver.familyName}**, ${startLabel(gainer.r)} → P${gainer.r.position} (+${gainer.gain}).`)
    }

    const retired = results.filter(r => r.positionText === 'R' || r.positionText === 'N').sort((a, b) => a.laps - b.laps)
    if (retired.length) facts.push(`Retirements: ${retired.map(r => `${r.driver.familyName} (lap ${r.laps})`).join(', ')}.`)
    const dns = results.filter(r => r.positionText === 'W')
    if (dns.length) facts.push(`Did not start: ${dns.map(r => r.driver.familyName).join(', ')}.`)
    const dsq = results.filter(r => r.positionText === 'D')
    if (dsq.length) facts.push(`Disqualified: ${dsq.map(r => r.driver.familyName).join(', ')}.`)

    return facts
}

export interface SessionData {
    drivers: OpenF1Driver[];
    raceControl: OpenF1RaceControl[];
    stints: OpenF1Stint[];
    weather: OpenF1Weather[];
    overtakes: OpenF1Overtake[];
}

// Facts from OpenF1 session data (2023 onwards)
export function sessionFacts(race: Race, data: SessionData): string[] {
    const nameByCode = new Map(race.results.map(r => [r.driver.code, r.driver.familyName]))
    const codeByNumber = new Map(data.drivers.map(d => [d.driver_number, d.name_acronym]))
    const nameOf = (code: string) => nameByCode.get(code) ?? code

    return [
        neutralisations(data.raceControl),
        penalties(data.raceControl, nameOf),
        strategy(race, data.stints, codeByNumber),
        weatherFact(data.weather),
        data.overtakes.length ? `${data.overtakes.length} overtakes recorded (OpenF1 count, includes pit-cycle position swaps).` : '',
    ].filter(Boolean)
}

// "VSC lap 14 · safety car laps 30–33 · red flag lap 41"
function neutralisations(messages: OpenF1RaceControl[]): string {
    const periods: Array<{ lap: number; text: string }> = []
    const add = (lap: number, text: string) => periods.push({ lap, text })
    let scStart: number | null = null
    let vscStart: number | null = null
    const range = (a: number, b: number | null) => (b && b > a ? `laps ${a}–${b}` : `lap ${a}`)

    for (const m of [...messages].sort((a, b) => a.date.localeCompare(b.date))) {
        const lap = m.lap_number ?? 0
        const msg = m.message
        if (m.category === 'Flag' && m.flag === 'RED') add(lap, `red flag lap ${lap}`)
        if (m.category !== 'SafetyCar') continue
        const isVsc = msg.includes('VSC') || msg.includes('VIRTUAL')
        if (msg.includes('DEPLOYED')) {
            if (isVsc) vscStart = lap
            else scStart = lap
        } else if (isVsc && msg.includes('ENDING') && vscStart !== null) {
            add(vscStart, `VSC ${range(vscStart, lap)}`)
            vscStart = null
        } else if (!isVsc && msg.includes('IN THIS LAP') && scStart !== null) {
            add(scStart, `safety car ${range(scStart, lap)}`)
            scStart = null
        }
    }
    if (vscStart !== null) add(vscStart, `VSC lap ${vscStart}`)
    if (scStart !== null) add(scStart, `safety car lap ${scStart}`)

    if (!periods.length) return 'No safety car, VSC or red flag.'
    const text = periods.sort((a, b) => a.lap - b.lap).map(p => p.text).join(' · ')
    return `Neutralisations: ${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

// "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 55 (SAI) - CAUSING A COLLISION (15:23:42)"
const PENALTY = /^FIA STEWARDS: (.+?) PENALTY FOR CAR \d+ \((\w+)\)(?: - (.+?))?(?: \([\d:]+\))?$/

function penaltyKind(raw: string): string {
    const seconds = raw.match(/^(\d+) SECOND TIME$/)
    if (seconds) return `${seconds[1]}s`
    if (raw === 'DRIVE THROUGH') return 'drive-through'
    if (raw.includes('STOP')) return 'stop-and-go'
    return raw.toLowerCase()
}

// Stewards write in capitals; lower-case it but keep the acronyms
const ACRONYMS = /\b(vsc|sc|drs|fia|pu)\b/g
function sentenceCase(text: string): string {
    return text.toLowerCase().replace(ACRONYMS, a => a.toUpperCase())
}

function penalties(messages: OpenF1RaceControl[], nameOf: (code: string) => string): string {
    const seen = new Set<string>()
    const items: string[] = []
    for (const m of messages) {
        const match = m.message.match(PENALTY)
        if (!match || m.message.includes('SERVED')) continue
        const [, kind, code, reason] = match
        const text = `${nameOf(code)} ${penaltyKind(kind)}${reason ? ` (${sentenceCase(reason)})` : ''}`
        if (seen.has(text)) continue
        seen.add(text)
        items.push(text)
    }
    return items.length ? `Penalties: ${items.join(' · ')}.` : ''
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

// "Winner's strategy: Medium → Hard (1 stop). Finishers: 14 one-stop, 6 two-stop."
function strategy(race: Race, stints: OpenF1Stint[], codeByNumber: Map<number, string>): string {
    if (!stints.length) return ''
    const byCode = new Map<string, OpenF1Stint[]>()
    for (const s of stints) {
        const code = codeByNumber.get(s.driver_number)
        if (!code) continue
        byCode.set(code, [...(byCode.get(code) ?? []), s])
    }

    const winner = race.results.find(r => r.position === 1)
    const winnerStints = winner ? (byCode.get(winner.driver.code) ?? []).sort((a, b) => a.stint_number - b.stint_number) : []
    const stopWord = (n: number) => `${n} stop${n === 1 ? '' : 's'}`
    const parts: string[] = []
    if (winnerStints.length) {
        const compounds = winnerStints.map(s => titleCase(s.compound ?? 'Unknown')).join(' → ')
        parts.push(`Winner's strategy: ${compounds} (${stopWord(winnerStints.length - 1)}).`)
    }

    const stopCounts = new Map<number, number>()
    for (const r of race.results.filter(isClassified)) {
        const driverStints = byCode.get(r.driver.code)
        if (!driverStints) continue
        const stops = driverStints.length - 1
        stopCounts.set(stops, (stopCounts.get(stops) ?? 0) + 1)
    }
    const words = ['no-stop', 'one-stop', 'two-stop', 'three-stop', 'four-stop']
    const breakdown = [...stopCounts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([stops, count]) => `${count} ${words[stops] ?? `${stops}-stop`}`)
    if (breakdown.length) parts.push(`Finishers: ${breakdown.join(', ')}.`)
    return parts.join(' ')
}

function weatherFact(weather: OpenF1Weather[]): string {
    if (!weather.length) return ''
    const avg = (pick: (w: OpenF1Weather) => number) => Math.round(weather.reduce((sum, w) => sum + pick(w), 0) / weather.length)
    const rain = weather.some(w => w.rainfall > 0)
    return `${rain ? 'Rain during the race' : 'Dry'} · air ${avg(w => w.air_temperature)}°C · track ${avg(w => w.track_temperature)}°C.`
}
