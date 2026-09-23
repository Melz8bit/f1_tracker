import { useFilterStore } from "../../store/filterStore";
import { useSeason } from "../../hooks/useSeason";
import { DIMENSIONS, latestMovers, scoreTeams, type SeasonPace, type TeamPace } from "../../lib/pace";
import { powerUnit, teamColor, teamNameById } from "../../lib/teams";
import paceRatingsJson from "../../data/paceRatings.json"

const paceRatings = paceRatingsJson as unknown as Record<string, SeasonPace | undefined>

// Tiers follow the overall ranking: 4 front-runners, 3 midfield, the rest
const TIERS = [
    { label: 'Top Teams', from: 0, to: 4 },
    { label: 'Midfield', from: 4, to: 7 },
    { label: 'Lower Midfield & New Entrants', from: 7, to: Infinity },
]

export default function PaceProfileTab() {
    const { season, state } = useSeason()
    const { roundMin } = useFilterStore()
    const seasonPace = paceRatings[String(season)]

    if (!state) return <p className="text-sm text-[#666]">Loading…</p>
    if (!seasonPace || Object.keys(seasonPace.rounds).length === 0) {
        return (
            <div className="card">
                <div className="ct">No pace data for {season}</div>
                <div className="cb">Pace ratings are generated offline from OpenF1 telemetry. Run <strong>npm run pace -- {season}</strong> to build them.</div>
            </div>
        )
    }

    const toRound = state.asOfRound
    const fromRound = Math.min(roundMin, toRound)
    const inRange = Object.entries(seasonPace.rounds)
        .map(([round, pace]) => [Number(round), pace] as const)
        .filter(([round]) => round >= fromRound && round <= toRound)
    const teams = scoreTeams(inRange.map(([, pace]) => pace))
    const latestInData = Math.max(...Object.keys(seasonPace.rounds).map(Number))
    const movers = latestMovers(inRange.map(([r, p]) => [r, p]))
    const corners = inRange.reduce((sum, [, p]) => ({ slow: sum.slow + p.corners.slow, high: sum.high + p.corners.high }), { slow: 0, high: 0 })
    const lastRound = inRange.length ? Math.max(...inRange.map(([r]) => r)) : undefined

    return (
        <>
            <p className="text-[13px] text-[#666] mb-1.5">
                All {teams.length} teams rated across {DIMENSIONS.length} dimensions, averaged over R{fromRound}–R{lastRound ?? toRound}.{' '}
                <strong className="text-[#aaa]">Overall score</strong> = average of all six. Scale: 100 = best on grid.
                {lastRound && <span className="new">Updated R{lastRound}</span>}
            </p>
            <p className="note mb-5">
                Computed from OpenF1 timing and telemetry: qualifying = each team's fastest lap; race pace = lap-by-lap
                comparison of clean laps (no pit, safety car or VSC laps); straight-line = speed-trap readings; cornering =
                speed through {corners.slow} slow (&lt;130 km/h) and {corners.high} fast (185+ km/h) corners on each team's best
                qualifying lap. Active aero is an estimate from straight-line and fast-corner speed together.
                {movers.length > 0 && (
                    <>
                        {' '}<strong className="text-[#e07040]">
                            R{lastRound} shifts: {movers.map(m => `${teamNameById(m.team)} ${m.change > 0 ? '+' : ''}${m.change}`).join(' · ')} vs earlier rounds.
                        </strong>
                    </>
                )}
                {latestInData < state.roundsDone && ` Pace data runs to R${latestInData}; run npm run pace to add newer rounds.`}
            </p>

            {TIERS.map(tier => {
                const tierTeams = teams.slice(tier.from, tier.to)
                if (!tierTeams.length) return null
                return (
                    <div key={tier.label}>
                        <div className={`tier-divider${tier.from === 0 ? ' mt-0 border-t-0 pt-0' : ''}`}>{tier.label}</div>
                        {tierTeams.map(t => <TeamBlock key={t.team} season={season} pace={t} />)}
                    </div>
                )
            })}
        </>
    )
}

function TeamBlock({ season, pace }: { season: number; pace: TeamPace }) {
    const color = teamColor(pace.team)
    const pu = powerUnit(season, pace.team)
    return (
        <div className="team-block">
            <div className="team-head">
                <div className="tdot" style={{ background: color }} />
                <div className="tname">{teamNameById(pace.team)}{pu && <span className="tpu">{pu} PU</span>}</div>
                <div className="overall-chip" style={{ background: `${color}22`, color }}>{pace.overall}</div>
            </div>
            {DIMENSIONS.map(d => {
                const score = pace.scores[d.key]
                return (
                    <div key={d.key} className="arow">
                        <div className="alabel">{d.label}{d.estimated && <span className="est" title="No public data isolates active aero — estimated from straight-line and fast-corner speed">est.</span>}</div>
                        <div className="btrack"><div className="bfill" style={{ width: `${score ?? 0}%`, background: color, opacity: 0.75 }} /></div>
                        <div className="aval">{score ?? '—'}</div>
                    </div>
                )
            })}
        </div>
    )
}
