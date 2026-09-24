import { useSeason } from "../../hooks/useSeason";
import { useDriverStandings } from "../../hooks/useDriverStandings";
import { useConstructorStandings } from "../../hooks/useConstructorStandings";
import { usePowerUnits } from "../../hooks/usePowerUnits";
import { useRaceNews } from "../../hooks/useRaceNews";
import { usePaceRatings } from "../../hooks/usePaceRatings";
import { useFilterStore } from "../../store/filterStore";
import { buildFormCards, constructorsTitleText, driversTitleText, type FormInputs } from "../../lib/formGuide";
import { scoreTeams } from "../../lib/pace";
import { teamColor } from "../../lib/teams";
import { shortRaceName } from "../../lib/format";
import RichText from "../shared/RichText";

export default function FormGuideTab() {
    const { season, state, schedule, races, sprints, isLoading, error } = useSeason()
    const { roundMin } = useFilterStore()
    const round = state && !state.isLatest ? state.asOfRound : undefined
    const enabled = !!state && state.asOfRound > 0
    const drivers = useDriverStandings(season, round, enabled)
    const constructors = useConstructorStandings(season, round, enabled)
    const puRounds = usePowerUnits(season)
    const news = useRaceNews(season)
    const paceData = usePaceRatings(season)

    if (isLoading || drivers.isLoading || constructors.isLoading) return <p className="text-sm text-[#666]">Loading form guide…</p>
    if (error || drivers.error || constructors.error) return <p className="text-sm text-[#ff4422]">Failed to load the form guide.</p>
    if (!state || state.asOfRound === 0) return <p className="text-sm text-[#666]">The season hasn't started yet.</p>

    const asOf = state.asOfRound
    const fromRound = Math.min(roundMin, asOf)
    const paceRounds = Object.entries(paceData)
        .filter(([r]) => Number(r) >= fromRound && Number(r) <= asOf)
        .map(([, p]) => p)
    const puRound = Math.max(0, ...Object.keys(puRounds).map(Number).filter(r => r <= asOf))

    const input: FormInputs = {
        season,
        state,
        schedule,
        races,
        sprints,
        drivers: drivers.data ?? [],
        constructors: constructors.data ?? [],
        pace: scoreTeams(paceRounds),
        puSnapshot: puRounds[puRound],
        puPenalties: Object.entries(puRounds)
            .filter(([r]) => Number(r) <= asOf)
            .flatMap(([r, d]) => d.penalties.map(p => ({ ...p, round: Number(r) }))),
    }
    const cards = buildFormCards(input)
    const driversText = driversTitleText(input)
    const constructorsText = constructorsTitleText(input)
    const latestStory = news.rounds[String(asOf)]

    return (
        <>
            <p className="text-[13px] text-[#666] mb-3.5">
                Category-by-category form after {asOf} rounds, calculated from results, standings, pace data and FIA power unit reports.
                <span className="new">Updated R{asOf}</span>
            </p>
            <div className="vgrid">
                {cards.map(card => {
                    const color = card.teamId ? teamColor(card.teamId) : '#55aa33'
                    return (
                        <div key={card.label} className="vcard" style={{ background: `linear-gradient(${color}14, ${color}14), #1a1a1a` }}>
                            <div className="vlabel">{card.label}</div>
                            <div className="vteam" style={{ color }}>{card.headline}</div>
                            <div className="vsub">{card.detail}</div>
                        </div>
                    )
                })}
            </div>
            {driversText && (
                <div className="card">
                    <div className="ct">The drivers' title</div>
                    <div className="cb"><RichText text={driversText} /></div>
                </div>
            )}
            {constructorsText && (
                <div className="card">
                    <div className="ct">The constructors' fight</div>
                    <div className="cb"><RichText text={constructorsText} /></div>
                </div>
            )}
            {latestStory && state.latest && (
                <div className="card">
                    <div className="ct">From the press · {shortRaceName(state.latest.raceName)}</div>
                    <div className="cb">
                        {latestStory.headline} <span className="text-[#555]">Full summary in Race by Race.</span>
                    </div>
                </div>
            )}
        </>
    )
}
