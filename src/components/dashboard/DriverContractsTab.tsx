import { useSeason } from "../../hooks/useSeason";
import { useDriverStandings } from "../../hooks/useDriverStandings";
import { useConstructorStandings } from "../../hooks/useConstructorStandings";
import { useRaceNews } from "../../hooks/useRaceNews";
import { applyLineup, useLineup } from "../../hooks/useLineup";
import { teamColor, teamName } from "../../lib/teams";
import { driverShortName, formatDay } from "../../lib/format";
import type { DriverStanding } from "../../types/f1";
import type { ContractNews, RoundNews } from "../../lib/news";
import DriverFlag from "../shared/DriverFlag";
import RichText from "../shared/RichText";
import contractsJson from "../../data/contracts.json"

interface Contract {
    expiry: string; // "2027", "2030+"
    status: string;
    talks: string | null;
    history: Array<{ period: string; team: string; note: string }>;
    source?: string; // Link for an individually updated entry
    updated?: string; // YYYY-MM-DD
}
interface SeasonContracts {
    asOfRound: number;
    reviewedOn: string;
    source: string;
    drivers: Record<string, Contract | undefined>;
}

const contracts = contractsJson as Record<string, SeasonContracts | undefined>

// Same grouping as Team Pace Profiles, but by constructors' championship position
const TIERS = [
    { label: 'Top Teams', from: 1, to: 4 },
    { label: 'Midfield', from: 5, to: 7 },
    { label: 'Lower Midfield & New Teams', from: 8, to: 99 },
]

// Contract / seat stories from the stored race summaries. Specific phrases only — a bare "retire" also
// matches race retirements, "future" matches everything
const CONTRACT_PATTERN = /\bcontracts?\b|\bextension\b|\bextend(s|ed)?\b[^.]{0,40}\b(deal|contract|stay)|\b(re-?)?sign(s|ed|ing)?\b[^.]{0,40}\b(deal|contract|for 20\d\d)|\bseat\b|\bsilly season\b|\bfuture\b[^.]{0,30}\b(beyond|at|with)\b|\bretire(s|ment)? from (F1|Formula 1|racing)|\bleav(e|es|ing) (the team|Mercedes|Ferrari|McLaren|Red Bull|Aston Martin|Williams|Alpine|Haas|Audi|Cadillac|Racing Bulls)/i

function pressMentions(rounds: Record<string, RoundNews>, familyName: string) {
    return Object.entries(rounds)
        .flatMap(([round, news]) => news.bullets
            .filter(b => b.text.includes(familyName) && CONTRACT_PATTERN.test(b.text))
            .map(b => ({ round: Number(round), text: b.text, source: news.sources.find(s => s.id === b.sources[0]) })))
        .sort((a, b) => b.round - a.round)
        .slice(0, 2)
}

// Newest confirmed contract announcement per driver, from the automatic race summaries
function latestContractNews(rounds: Record<string, RoundNews>): Map<string, ContractNews> {
    const latest = new Map<string, ContractNews>()
    for (const news of Object.values(rounds)) {
        for (const c of news.contracts ?? []) {
            const current = latest.get(c.driverId)
            if (!current || c.published > current.published) latest.set(c.driverId, c)
        }
    }
    return latest
}

function expiryClass(expiry: string, season: number): string {
    const year = parseInt(expiry)
    if (!year || year <= season) return 'exp-this'
    return year === season + 1 ? 'exp-near' : 'exp-secure'
}

export default function DriverContractsTab() {
    const { season, state } = useSeason()
    const round = state && !state.isLatest ? state.asOfRound : undefined
    const enabled = !!state && state.asOfRound > 0
    const drivers = useDriverStandings(season, round, enabled)
    const constructors = useConstructorStandings(season, round, enabled)
    const news = useRaceNews(season)
    const lineup = useLineup(season)
    const data = contracts[String(season)]

    if (drivers.isLoading || constructors.isLoading) return <p className="text-sm text-[#666]">Loading…</p>
    if (!data) return <div className="card"><div className="ct">No contract notes for {season}</div></div>

    const teamPosition = new Map((constructors.data ?? []).map(c => [c.constructor.constructorId, c.position]))
    const byTeam = new Map<string, DriverStanding[]>()
    const current = state?.isLatest ? applyLineup(drivers.data ?? [], lineup) : drivers.data ?? []
    for (const d of current) byTeam.set(d.constructor.constructorId, [...(byTeam.get(d.constructor.constructorId) ?? []), d])
    const teams = [...byTeam.keys()].sort((a, b) => (teamPosition.get(a) ?? 99) - (teamPosition.get(b) ?? 99))
    const stale = state && state.roundsDone > data.asOfRound
    const autoUpdates = latestContractNews(news.rounds)

    return (
        <>
            <p className="contracts-note">
                {data.source} Last reviewed after R{data.asOfRound} ({formatDay(data.reviewedOn)}).
                {stale && <span className="new">Review due</span>}
                {' '}Teams and line-ups are live from the results; "In the press" lines come from the automatic race summaries.
            </p>
            {TIERS.map(tier => {
                const tierTeams = teams.filter(t => (teamPosition.get(t) ?? 99) >= tier.from && (teamPosition.get(t) ?? 99) <= tier.to)
                if (!tierTeams.length) return null
                return (
                    <div key={tier.label}>
                        <div className={`tier-divider${tier.from === 1 ? ' mt-0 border-t-0 pt-0' : ''}`}>{tier.label}</div>
                        {tierTeams.flatMap(team => byTeam.get(team)!.map(d => (
                            <DriverContract
                                key={d.driver.driverId}
                                standing={d}
                                contract={data.drivers[d.driver.driverId]}
                                auto={autoUpdates.get(d.driver.driverId)}
                                reviewedOn={data.reviewedOn}
                                season={season}
                                news={news.rounds}
                            />
                        )))}
                    </div>
                )
            })}
        </>
    )
}

interface DriverContractProps {
    standing: DriverStanding;
    contract?: Contract;
    auto?: ContractNews; // Newest announcement found automatically in the press
    reviewedOn: string;
    season: number;
    news: Record<string, RoundNews>;
}

function DriverContract({ standing, contract, auto, reviewedOn, season, news }: DriverContractProps) {
    const color = teamColor(standing.constructor.constructorId)
    const mentions = pressMentions(news, standing.driver.familyName)
    // An automatic update newer than the hand-written entry wins the expiry chip
    const autoIsNewer = auto && auto.published > (contract?.updated ?? reviewedOn)
    const expiry = autoIsNewer && auto.expiry ? auto.expiry : contract?.expiry
    return (
        <div className="contract-block">
            <div className="contract-head">
                <DriverFlag nationality={standing.driver.nationality} />
                <div className="contract-name">
                    {driverShortName(standing.driver)}
                    <span className="contract-team"><span className="pip" style={{ background: color }} />{teamName(standing.constructor)}</span>
                </div>
                {expiry && <span className={`contract-expiry ${expiryClass(expiry, season)}`}>Until {expiry}</span>}
            </div>
            {auto && (
                <div className="contract-auto">
                    <span className="contract-auto-tag">Latest</span>
                    {auto.change}{auto.expiry && ` Runs to ${auto.expiry}.`}
                    <span className="text-[#555]"> · {formatDay(auto.published)} · </span>
                    <a href={auto.url} target="_blank" rel="noreferrer" className="underline decoration-[#333] hover:text-[#ccc]">{auto.site}</a>
                </div>
            )}
            {contract ? (
                <>
                    <div className="contract-meta">
                        <div className="contract-meta-item">
                            <div className="cmi-label">
                                Contract status
                                {contract.updated && <span className="normal-case tracking-normal text-[#555]"> · updated {formatDay(contract.updated)}</span>}
                                {contract.source && <a className="press-ref" href={contract.source} target="_blank" rel="noreferrer">source</a>}
                            </div>
                            <div className="cmi-value">{contract.status}</div>
                        </div>
                        <div className="contract-meta-item">
                            <div className="cmi-label">Contract history</div>
                            <div className="contract-history">
                                {contract.history.map(h => (
                                    <div key={h.period}><span className="text-[#888]">{h.period}</span> — <span className="text-[#666]">{h.team}</span>: {h.note}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {contract.talks && <div className="contract-talks"><strong>Paddock talks:</strong> {contract.talks}</div>}
                </>
            ) : (
                <div className="cmi-value text-[#555]">No contract notes yet.</div>
            )}
            {mentions.map((m, i) => (
                <div key={i} className="contract-press">
                    <span className="text-[#555]">In the press · R{m.round}: </span><RichText text={m.text} />
                    {m.source && <a className="press-ref" href={m.source.url} target="_blank" rel="noreferrer" title={m.source.title}>{m.source.site}</a>}
                </div>
            ))}
        </div>
    )
}
