// Internal Imports
import { useSeason } from '../../hooks/useSeason'
import { useDriverStandings } from '../../hooks/useDriverStandings'
import { useConstructorStandings } from '../../hooks/useConstructorStandings'
import { useFilterStore } from '../../store/filterStore'
import { maxRemainingPoints, pointsSystem, titleStatus, TITLE_ZONE, type MaxRemaining } from '../../lib/championship'
import { buildProgression } from '../../lib/progression'
import { teamColor, teamName } from '../../lib/teams'
import { circuitCode, driverShortName, formatDay, formatPoints, formatWeekend, shortRaceName } from '../../lib/format'
import type { ConstructorStanding, DriverStanding, Race, RaceResult } from '../../types/f1'
import type { SeasonState } from '../../lib/season'
import TitlePill from '../shared/TitlePill'
import DriverFlag from '../shared/DriverFlag'
import PointsProgressionChart, { type ChartSeries } from '../charts/PointsProgressionChart'

const TOP_CONSTRUCTORS = 5
const TOP_DRIVERS = 7

export default function StandingsTab() {
    const { season, state, schedule, races, sprints, isLoading, error } = useSeason()
    const { roundMin } = useFilterStore()

    // Latest standings unless the round filter is looking back
    const round = state && !state.isLatest ? state.asOfRound : undefined
    const enabled = !!state && state.asOfRound > 0
    const drivers = useDriverStandings(season, round, enabled)
    const constructors = useConstructorStandings(season, round, enabled)

    if (isLoading || drivers.isLoading || constructors.isLoading) return <p className="text-sm text-[#666]">Loading standings…</p>
    if (error || drivers.error || constructors.error) return <p className="text-sm text-[#ff4422]">Failed to load standings.</p>
    if (!state) return null
    if (state.asOfRound === 0) {
        const first = schedule[0]
        return <p className="text-sm text-[#666]">The {season} season hasn't started yet{first ? ` — ${first.raceName}, ${formatWeekend(first)}` : ''}.</p>
    }

    const driverRows = drivers.data ?? []
    const constructorRows = constructors.data ?? []
    const maxLeft = maxRemainingPoints(season, state.racesLeft, state.sprintsLeft)
    const latestRace = races.find(r => r.round === state.asOfRound)
    const roundLabels = Object.fromEntries(schedule.map(r => [r.round, circuitCode(r)]))

    return (
        <>
            <MetricCards state={state} drivers={driverRows} constructors={constructorRows} maxLeft={maxLeft} />
            <TitleNote season={season} state={state} maxLeft={maxLeft} />

            <div className="section-label">Constructors' Championship</div>
            <ConstructorList standings={constructorRows} latestRace={latestRace} maxLeft={maxLeft.constructors} />

            <div className="section-label mt-6">Drivers' Championship — All {driverRows.length} Drivers</div>
            <DriverTable standings={driverRows} maxLeft={maxLeft.drivers} />
            <Footnote state={state} />

            <ProgressionCharts
                races={races}
                sprints={sprints}
                drivers={driverRows}
                fromRound={Math.min(roundMin, state.asOfRound)}
                toRound={state.asOfRound}
                roundLabels={roundLabels}
                hasSprints={sprints.length > 0}
            />
        </>
    )
}

// ── Metric cards ──────────────────────────────────────────────────

interface MetricCardsProps {
    state: SeasonState;
    drivers: DriverStanding[];
    constructors: ConstructorStanding[];
    maxLeft: MaxRemaining;
}

function MetricCards({ state, drivers, constructors, maxLeft }: MetricCardsProps) {
    const [d1, d2] = drivers
    const [c1, c2] = constructors
    return (
        <div className="grid4">
            <div className="metric">
                <div className="ml">Rounds completed</div>
                <div className="mv">{state.asOfRound} <span className="text-sm text-[#555]">/ {state.totalRounds}</span></div>
                {state.latest && <div className="ms">Latest: {shortRaceName(state.latest.raceName)} · {formatDay(state.latest.date)}</div>}
            </div>
            {d1 && (
                <div className="metric">
                    <div className="ml">Driver leader</div>
                    <div className="mv" style={{ color: teamColor(d1.constructor.constructorId) }}>{d1.driver.familyName}</div>
                    <div className="ms">{formatPoints(d1.points)} pts{d2 && ` · +${formatPoints(d1.points - d2.points)} over ${d2.driver.familyName}`}</div>
                </div>
            )}
            {c1 && (
                <div className="metric">
                    <div className="ml">Constructor leader</div>
                    <div className="mv" style={{ color: teamColor(c1.constructor.constructorId) }}>{teamName(c1.constructor)}</div>
                    <div className="ms">{formatPoints(c1.points)} pts{c2 && ` · +${formatPoints(c1.points - c2.points)} over ${teamName(c2.constructor)}`}</div>
                </div>
            )}
            <div className="metric">
                <div className="ml">Remaining rounds</div>
                <div className="mv">{state.racesLeft}</div>
                <div className="ms">Max pts left: {maxLeft.drivers} (drivers) · {maxLeft.constructors} (constructors)</div>
            </div>
        </div>
    )
}

// ── Title eligibility explainer ───────────────────────────────────

function TitleNote({ season, state, maxLeft }: { season: number; state: SeasonState; maxLeft: MaxRemaining }) {
    const { race, sprint, fastestLap } = pointsSystem(season)
    const sprintText = state.sprintsLeft > 0 ? ` (${state.sprintsLeft} sprint weekend${state.sprintsLeft === 1 ? '' : 's'})` : ''
    return (
        <div className="title-note">
            <strong>Title eligibility method:</strong> a driver or constructor is mathematically alive if their points plus
            every point still available reach the leader's total. {state.racesLeft} race{state.racesLeft === 1 ? '' : 's'} remain{state.racesLeft === 1 ? 's' : ''}{sprintText}.
            Max remaining: <strong>{maxLeft.drivers} driver pts</strong> · <strong>{maxLeft.constructors} constructor pts</strong>
            {' '}({race[0]} per race win{sprint.length > 0 && `, ${sprint[0]} per sprint win`}{fastestLap ? ', 1 for fastest lap' : ', no fastest-lap point'}).
            {' '}<strong>In the fight</strong> = can still win · <strong>Unlikely</strong> = gap exceeds 50% of remaining points (40% for constructors) · <strong>Eliminated</strong> = mathematically out.
        </div>
    )
}

// ── Constructors ──────────────────────────────────────────────────

// "Leclerc P4", "Hamilton DNF lap 6"
function finishLabel(result: RaceResult): string {
    const name = result.driver.familyName
    switch (result.positionText) {
        case 'R': return `${name} DNF lap ${result.laps}`
        case 'D': return `${name} DSQ`
        case 'W': return `${name} DNS`
        case 'N': return `${name} NC`
        default: return `${name} P${result.position}`
    }
}

function constructorBadge(standing: ConstructorStanding, latestRace: Race | undefined): string {
    const parts: string[] = []
    if (standing.wins > 0) parts.push(`${standing.wins} win${standing.wins === 1 ? '' : 's'}`)
    const teamResults = (latestRace?.results ?? [])
        .filter(r => r.constructor.constructorId === standing.constructor.constructorId)
        .sort((a, b) => a.position - b.position)
    parts.push(...teamResults.map(finishLabel))
    return parts.join(' · ')
}

function ConstructorList({ standings, latestRace, maxLeft }: { standings: ConstructorStanding[]; latestRace?: Race; maxLeft: number }) {
    const leader = standings[0]?.points ?? 0
    const runnerUp = standings[1]?.points ?? 0
    return (
        <div>
            {standings.map(s => {
                const color = teamColor(s.constructor.constructorId)
                const badge = constructorBadge(s, latestRace)
                return (
                    <div key={s.constructor.constructorId} className="con-row">
                        <span className="con-pos">{s.position}</span>
                        <span className="con-name">
                            <span><span className="pip" style={{ background: color }} />{teamName(s.constructor)}</span>
                            {badge && <span className="con-badge">{badge}</span>}
                        </span>
                        <div className="con-bar-wrap"><div className="con-bar" style={{ width: `${leader ? (s.points / leader) * 100 : 0}%`, background: color }} /></div>
                        <span className="con-pts">{formatPoints(s.points)}</span>
                        <TitlePill status={titleStatus(s.points, leader, runnerUp, maxLeft, 'constructors')} />
                    </div>
                )
            })}
        </div>
    )
}

// ── Drivers ───────────────────────────────────────────────────────

function DriverTable({ standings, maxLeft }: { standings: DriverStanding[]; maxLeft: number }) {
    const leader = standings[0]?.points ?? 0
    const runnerUp = standings[1]?.points ?? 0
    const statuses = standings.map(s => titleStatus(s.points, leader, runnerUp, maxLeft, 'drivers'))
    return (
        <table className="drv">
            <thead>
                <tr>
                    <th style={{ width: 28 }}>P</th>
                    <th>Driver</th>
                    <th className="r" style={{ width: 48 }}>Pts</th>
                    <th style={{ width: 90, paddingLeft: 10 }}>Bar</th>
                    <th className="r" style={{ width: 44 }}>Gap</th>
                    <th style={{ width: 96, textAlign: 'center' }}>Title?</th>
                </tr>
            </thead>
            <tbody>
                {standings.map((s, i) => {
                    const status = statuses[i]
                    const zone = TITLE_ZONE[status]
                    const showZone = i === 0 || zone !== TITLE_ZONE[statuses[i - 1]]
                    const color = teamColor(s.constructor.constructorId)
                    return [
                        showZone && <tr key={`zone-${zone}`} className="drv-zone-hdr"><td colSpan={6}>{zone}</td></tr>,
                        <tr key={s.driver.driverId}>
                            <td className="font-semibold text-[#555]" style={{ paddingLeft: 10 }}>{s.position}</td>
                            <td>
                                <div className="flex items-center gap-2">
                                    <DriverFlag nationality={s.driver.nationality} />
                                    <div>
                                        <div className="drv-name">{driverShortName(s.driver)}</div>
                                        <div className="drv-team"><span className="pip" style={{ background: color }} />{teamName(s.constructor)}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="text-right font-semibold">{formatPoints(s.points)}</td>
                            <td style={{ paddingLeft: 10 }}>
                                <div className="pts-bar-wrap"><div className="pts-bar" style={{ width: `${leader ? (s.points / leader) * 100 : 0}%`, background: color }} /></div>
                            </td>
                            <td className="text-right text-xs text-[#555]">{s.points === leader ? '—' : `-${formatPoints(leader - s.points)}`}</td>
                            <td className="text-center"><TitlePill status={status} /></td>
                        </tr>,
                    ]
                })}
            </tbody>
        </table>
    )
}

function Footnote({ state }: { state: SeasonState }) {
    const { latest, next } = state
    return (
        <p className="note">
            {latest && `After R${latest.round} ${shortRaceName(latest.raceName)} (${formatDay(latest.date)}).`}
            {next && ` Next: ${shortRaceName(next.raceName)} · ${next.locality} · ${formatWeekend(next)}${next.sprintDate ? ' · sprint weekend' : ''}.`}
        </p>
    )
}

// ── Points progression ────────────────────────────────────────────

interface ProgressionChartsProps {
    races: Race[];
    sprints: Race[];
    drivers: DriverStanding[];
    fromRound: number;
    toRound: number;
    roundLabels: Record<number, string>;
    hasSprints: boolean;
}

function ProgressionCharts({ races, sprints, drivers, fromRound, toRound, roundLabels, hasSprints }: ProgressionChartsProps) {
    const conProgression = buildProgression(races, sprints, r => r.constructor.constructorId, fromRound, toRound)
    const drvProgression = buildProgression(races, sprints, r => r.driver.driverId, fromRound, toRound)

    // Constructor names come from results; the last one seen is the current name
    const constructorsById = new Map(races.flatMap(r => r.results).map(r => [r.constructor.constructorId, r.constructor]))
    const conSeries: ChartSeries[] = conProgression.series.slice(0, TOP_CONSTRUCTORS).map(s => {
        const constructor = constructorsById.get(s.id)
        return { id: s.id, label: constructor ? teamName(constructor) : s.id, color: teamColor(s.id) }
    })

    // Colour by current team; the lower-placed teammate gets a dashed line
    const standingById = new Map(drivers.map(d => [d.driver.driverId, d]))
    const teamsSeen = new Set<string>()
    const drvSeries: ChartSeries[] = drvProgression.series.slice(0, TOP_DRIVERS).map(s => {
        const standing = standingById.get(s.id)
        const teamId = standing?.constructor.constructorId ?? ''
        const dashed = teamsSeen.has(teamId)
        teamsSeen.add(teamId)
        return {
            id: s.id,
            label: `${standing?.driver.familyName ?? s.id} (${formatPoints(s.total)})`,
            color: teamColor(teamId),
            dashed,
        }
    })

    const sprintNote = hasSprints ? ' Sprint points included.' : ''
    return (
        <>
            <div className="section-label mt-7">Points Progression — Constructors</div>
            <p className="chart-caption">Cumulative points per round. Top {TOP_CONSTRUCTORS} constructors shown.{sprintNote}</p>
            <PointsProgressionChart progression={conProgression} series={conSeries} roundLabels={roundLabels} height={260} />

            <div className="section-label mt-7">Points Progression — Drivers</div>
            <p className="chart-caption">Cumulative points per round. Top {TOP_DRIVERS} drivers shown; dashed = second driver of a team.{sprintNote}</p>
            <PointsProgressionChart progression={drvProgression} series={drvSeries} roundLabels={roundLabels} height={300} />
        </>
    )
}
