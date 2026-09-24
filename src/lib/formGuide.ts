// Form Guide cards, computed from results, standings, pace ratings and power unit data.
// Every number comes from the APIs — nothing here is hand-written.
import type { ConstructorStanding, DriverStanding, Race, RaceResult, ScheduleRace } from '../types/f1'
import type { SeasonState } from './season'
import { maxRemainingPoints, pointsSystem } from './championship'
import { formatPoints, formatWeekend, shortRaceName } from './format'
import { teamName, teamNameById } from './teams'
import { LIMITS, ELEMENTS, type RoundPU, type PUPenalty } from './powerUnits'
import type { TeamPace } from './pace'

export interface FormCard {
    label: string;
    headline: string; // Big text
    teamId?: string; // Colours the headline
    detail: string;
}

export interface FormInputs {
    season: number;
    state: SeasonState;
    schedule: ScheduleRace[];
    races: Race[];
    sprints: Race[];
    drivers: DriverStanding[];
    constructors: ConstructorStanding[];
    pace: TeamPace[];
    puSnapshot?: RoundPU;
    puPenalties: Array<PUPenalty & { round: number }>;
}

const RECENT_ROUNDS = 3

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function pointsInRounds(races: Race[], sprints: Race[], rounds: Set<number>): Map<string, { points: number; result: RaceResult }> {
    const totals = new Map<string, { points: number; result: RaceResult }>()
    for (const event of [...races, ...sprints]) {
        if (!rounds.has(event.round)) continue
        for (const r of event.results) {
            const entry = totals.get(r.driver.driverId) ?? { points: 0, result: r }
            entry.points += r.points
            totals.set(r.driver.driverId, entry)
        }
    }
    return totals
}

export function buildFormCards(input: FormInputs): FormCard[] {
    const { state, races, sprints, drivers, constructors, pace, puSnapshot, puPenalties, season } = input
    const asOf = state.asOfRound
    const done = races.filter(r => r.round <= asOf && r.results.length > 0)
    const latest = done.find(r => r.round === asOf)
    const cards: FormCard[] = []

    const [d1, d2] = drivers
    if (d1) {
        cards.push({
            label: "Championship leader",
            headline: d1.driver.familyName,
            teamId: d1.constructor.constructorId,
            detail: `${plural(d1.wins, 'win')} · ${formatPoints(d1.points)} pts${d2 ? ` · +${formatPoints(d1.points - d2.points)} over ${d2.driver.familyName}` : ''}`,
        })
    }

    const winner = latest?.results.find(r => r.position === 1)
    if (latest && winner) {
        cards.push({
            label: `Latest winner · R${latest.round}`,
            headline: winner.driver.familyName,
            teamId: winner.constructor.constructorId,
            detail: `${shortRaceName(latest.raceName)} · from ${winner.grid === 0 ? 'the pit lane' : winner.grid === 1 ? 'pole' : `P${winner.grid}`}`,
        })
    }

    // Most points over the last few rounds (sprints included), leader excluded — they already have a card
    const recent = new Set(done.map(r => r.round).filter(r => r > asOf - RECENT_ROUNDS))
    const hot = [...pointsInRounds(races, sprints, recent).values()]
        .filter(x => x.result.driver.driverId !== d1?.driver.driverId)
        .sort((a, b) => b.points - a.points)[0]
    if (hot && recent.size > 1) {
        cards.push({
            label: 'Hottest form · chasing pack',
            headline: hot.result.driver.familyName,
            teamId: hot.result.constructor.constructorId,
            detail: `${formatPoints(hot.points)} pts in the last ${recent.size} rounds (R${Math.min(...recent)}–R${Math.max(...recent)})`,
        })
    }

    const fastest = pace[0]
    if (fastest) {
        cards.push({
            label: 'Fastest car',
            headline: teamNameById(fastest.team),
            teamId: fastest.team,
            detail: `Overall pace score ${fastest.overall}${pace[1] ? ` · ${teamNameById(pace[1].team)} next on ${pace[1].overall}` : ''}`,
        })
    }

    // Tightest gap between neighbours in the constructors' table, for a place that matters (P2–P7)
    const CONTESTED = { from: 2, to: 7 }
    const pairs = constructors.slice(1).map((c, i) => ({ ahead: constructors[i], behind: c, gap: constructors[i].points - c.points }))
    const closest = pairs
        .filter(p => p.ahead.position >= CONTESTED.from && p.ahead.position <= CONTESTED.to)
        .sort((a, b) => a.gap - b.gap)[0]
    if (closest) {
        cards.push({
            label: 'Closest fight',
            headline: `${teamName(closest.ahead.constructor)} vs ${teamName(closest.behind.constructor)}`,
            teamId: closest.ahead.constructor.constructorId,
            detail: `${plural(closest.gap, 'pt')} apart for P${closest.ahead.position} in the constructors'`,
        })
    }

    // Retirements this season, by team
    const dnfs = done.flatMap(r => r.results.filter(x => x.positionText === 'R').map(x => ({ race: r, result: x })))
    const byTeam = new Map<string, typeof dnfs>()
    for (const d of dnfs) byTeam.set(d.result.constructor.constructorId, [...(byTeam.get(d.result.constructor.constructorId) ?? []), d])
    const worst = [...byTeam.values()].sort((a, b) => b.length - a.length || b[b.length - 1].race.round - a[a.length - 1].race.round)[0]
    if (worst) {
        const last = worst[worst.length - 1]
        cards.push({
            label: 'Reliability watch',
            headline: teamName(last.result.constructor),
            teamId: last.result.constructor.constructorId,
            detail: `${plural(worst.length, 'retirement')} · latest: ${last.result.driver.familyName}, R${last.race.round} lap ${last.result.laps}`,
        })
    }

    // Power unit elements over the season allocation
    const limits = LIMITS[season]
    if (puSnapshot && limits) {
        const over = puSnapshot.drivers
            .map(d => ({ d, over: ELEMENTS.reduce((sum, e) => sum + Math.max(0, d.counts[e] - limits[e]), 0) }))
            .sort((a, b) => b.over - a.over)[0]
        if (over && over.over > 0) {
            const lastPenalty = puPenalties.filter(p => p.car === over.d.car).sort((a, b) => b.round - a.round)[0]
            cards.push({
                label: 'Grid penalty watch',
                headline: over.d.driver.split(' ').pop() ?? over.d.driver,
                teamId: over.d.constructorId,
                detail: `${plural(over.over, 'PU element')} over the limit${lastPenalty ? ` · latest: R${lastPenalty.round} ${lastPenalty.pitLane ? 'pit-lane start' : `−${lastPenalty.gridDrop} grid`}` : ''}`,
            })
        }
    }

    const next = state.next
    if (next) {
        cards.push({
            label: 'Next race',
            headline: shortRaceName(next.raceName),
            detail: `${next.locality} · ${formatWeekend(next)}${next.sprintDate ? ' · sprint weekend' : ''}`,
        })
    }
    return cards
}

// ── Written cards: the two title fights ───────────────────────────

// Points a single weekend can move the gap by: a win for the leader's rival and nothing for the leader
function maxSwingNextRound(season: number, next: ScheduleRace | undefined, constructors: boolean): number {
    if (!next) return 0
    const { race, sprint, fastestLap } = pointsSystem(season)
    const racePts = constructors ? race[0] + race[1] + fastestLap : race[0] + fastestLap
    const sprintPts = next.sprintDate ? (constructors ? (sprint[0] ?? 0) + (sprint[1] ?? 0) : sprint[0] ?? 0) : 0
    return racePts + sprintPts
}

export function driversTitleText(input: FormInputs): string | undefined {
    const { season, state, drivers } = input
    const [d1, d2] = drivers
    if (!d1 || !d2) return undefined
    const lead = d1.points - d2.points
    const { drivers: maxLeft } = maxRemainingPoints(season, state.racesLeft, state.sprintsLeft)
    if (lead > maxLeft) return `**${d1.driver.familyName}** is champion — ${formatPoints(lead)} points clear with only ${maxLeft} left to race for.`

    const parts = [
        `**${d1.driver.familyName}** leads by **${formatPoints(lead)} points** over ${d2.driver.familyName} with ${plural(state.racesLeft, 'race')} left and ${maxLeft} points still available.`,
        `${plural(d1.wins, 'win')} from ${state.asOfRound} rounds.`,
    ]
    // Clinching next round: the lead after it must exceed everything still available afterwards
    const next = state.next
    if (next) {
        const swing = maxSwingNextRound(season, next, false)
        const leftAfter = maxLeft - swing
        const needed = leftAfter - lead + 1 // Points he must gain on every rival at the next round
        if (needed <= swing) {
            parts.push(needed <= 0
                ? `He can clinch the title at the ${shortRaceName(next.raceName)} whatever his rivals do.`
                : `He can clinch at the ${shortRaceName(next.raceName)} by outscoring every rival by ${plural(needed, 'point')}.`)
        }
    }
    const inFight = drivers.filter(d => d.points + maxLeft >= d1.points).length - 1
    parts.push(inFight === 1 ? `Only ${d2.driver.familyName} can still catch him.` : `${inFight} drivers can still mathematically catch him.`)
    return parts.join(' ')
}

export function constructorsTitleText(input: FormInputs): string | undefined {
    const { season, state, constructors } = input
    const [c1, c2, c3] = constructors
    if (!c1 || !c2) return undefined
    const { constructors: maxLeft } = maxRemainingPoints(season, state.racesLeft, state.sprintsLeft)
    const lead = c1.points - c2.points
    const parts = [
        lead > maxLeft
            ? `**${teamName(c1.constructor)}** have won the constructors' title (${formatPoints(c1.points)} pts).`
            : `**${teamName(c1.constructor)}** lead on ${formatPoints(c1.points)} points, ${formatPoints(lead)} clear of ${teamName(c2.constructor)} with ${maxLeft} still available.`,
    ]
    if (c3) parts.push(`**${teamName(c2.constructor)}** (${formatPoints(c2.points)}) and **${teamName(c3.constructor)}** (${formatPoints(c3.points)}) are ${plural(c2.points - c3.points, 'point')} apart in the fight for second.`)
    const alive = constructors.filter(c => c.points + maxLeft >= c1.points).length
    parts.push(alive <= 1 ? 'No one else can catch the leaders.' : `${alive} teams can still mathematically win it.`)
    return parts.join(' ')
}
