import { useSeason } from "../../hooks/useSeason";
import { useConstructorStandings } from "../../hooks/useConstructorStandings";
import { usePowerUnits } from "../../hooks/usePowerUnits";
import { useRaceNews } from "../../hooks/useRaceNews";
import { supplierFromEntry } from "../../lib/powerUnits";
import { teamNameById } from "../../lib/teams";
import { circuitCode, formatDay, formatPoints, shortRaceName } from "../../lib/format";
import type { ConstructorStanding, ScheduleRace } from "../../types/f1";
import type { SeasonState } from "../../lib/season";
import type { RoundNews } from "../../lib/news";
import RichText from "../shared/RichText";
import regulationsJson from "../../data/regulations.json"

interface RegCard { title: string; body: string; live?: string }
interface Period { name: string; fromCircuit: string; toCircuit: string; result?: string; resultDate?: string }
interface Manufacturer { supplier: string; gap: string; upgrades2026: number; upgrades2027: number; note: string }
interface SeasonRegs {
    asOfRound: number;
    reviewedOn: string;
    intro: string;
    cards: RegCard[];
    aduo: {
        explainer: string;
        thresholds: Array<{ gap: string; upgrades2026: number; upgrades2027: number; budget: string }>;
        thresholdsNote: string;
        periods: Period[];
        manufacturers: Manufacturer[];
        sources: Array<{ title: string; url: string }>;
    };
}

const regulations = regulationsJson as Record<string, SeasonRegs | undefined>

export default function RegChangesTab() {
    const { season, state, schedule } = useSeason()
    const round = state && !state.isLatest ? state.asOfRound : undefined
    const constructors = useConstructorStandings(season, round, !!state && state.asOfRound > 0)
    const puRounds = usePowerUnits(season)
    const news = useRaceNews(season)
    const regs = regulations[String(season)]

    if (!regs) {
        return <div className="card"><div className="ct">No regulation notes for {season}</div><div className="cb">This tab covers the 2026 rule reset.</div></div>
    }

    // Supplier → customer teams, from the FIA entry names in the latest power unit report
    const latestPU = puRounds[Math.max(0, ...Object.keys(puRounds).map(Number))]
    const customers = new Map<string, Set<string>>()
    for (const d of latestPU?.drivers ?? []) {
        if (!d.constructorId) continue
        const supplier = supplierFromEntry(d.team)
        customers.set(supplier, (customers.get(supplier) ?? new Set()).add(teamNameById(d.constructorId)))
    }
    const stale = state && state.roundsDone > regs.asOfRound

    return (
        <>
            <p className="text-[13px] text-[#666] mb-4">{regs.intro}</p>
            {regs.cards.map(card => (
                <div key={card.title} className="reg-card">
                    <div className="reg-title">{card.title}</div>
                    <div className="reg-body">
                        <RichText text={card.body} />
                        {card.live && <LiveFact live={card.live} state={state} constructors={constructors.data ?? []} customers={customers} />}
                    </div>
                </div>
            ))}

            <div className="aduo-section">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="text-[15px] font-bold text-white">ADUO Tracker</div>
                    <span className="aduo-live">From FIA</span>
                </div>
                <div className="text-xs text-[#555] mb-4">Additional Development and Upgrade Opportunities — the 2026 engine catch-up mechanism</div>

                <div className="reg-card aduo">
                    <div className="reg-title">What is ADUO?</div>
                    <div className="reg-body"><RichText text={regs.aduo.explainer} /></div>
                </div>

                <div className="reg-card aduo">
                    <div className="reg-title">Upgrade and budget thresholds</div>
                    <table className="aduo-tbl">
                        <thead><tr><th>ICE gap to best</th><th className="c">2026 upgrades</th><th className="c">2027 upgrades</th><th className="r">Extra budget</th></tr></thead>
                        <tbody>
                            {regs.aduo.thresholds.map(t => (
                                <tr key={t.gap}><td className="strong">{t.gap}</td><td className="c">{t.upgrades2026}</td><td className="c">{t.upgrades2027}</td><td className="r">{t.budget}</td></tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="aduo-note">{regs.aduo.thresholdsNote}</div>
                </div>

                <div className="reg-card aduo">
                    <div className="reg-title">Review periods — {season}</div>
                    <table className="aduo-tbl">
                        <thead><tr><th>Period</th><th>Races</th><th>Result</th><th className="c">Status</th></tr></thead>
                        <tbody>
                            {regs.aduo.periods.map(p => <PeriodRow key={p.name} period={p} schedule={schedule} state={state} />)}
                        </tbody>
                    </table>
                </div>

                <div className="reg-card aduo">
                    <div className="reg-title">Manufacturer status</div>
                    <table className="aduo-tbl">
                        <thead><tr><th>Manufacturer</th><th>Teams using it</th><th className="c">ICE gap</th><th className="c">Extra upgrades</th></tr></thead>
                        <tbody>
                            {regs.aduo.manufacturers.map(m => (
                                <tr key={m.supplier} title={m.note}>
                                    <td className="strong">{m.supplier}</td>
                                    <td className="muted">{[...(customers.get(m.supplier) ?? [])].join(' · ') || '—'}</td>
                                    <td className="c"><span className={`aduo-pill ${m.upgrades2026 ? 'yes' : 'none'}`}>{m.gap}</span></td>
                                    <td className="c">{m.upgrades2026 ? `${m.upgrades2026} in 2026 · ${m.upgrades2027} in 2027` : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="aduo-note">
                        The FIA publishes which manufacturers qualify, not the performance figures, and not when each upgrade is introduced.
                    </div>
                </div>

                <PressMentions rounds={news.rounds} />

                <p className="note">
                    Sources: {regs.aduo.sources.map((s, i) => (
                        <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-[#333] hover:text-[#aaa]">{s.title}</a></span>
                    ))}. Regulation notes last reviewed after R{regs.asOfRound} ({formatDay(regs.reviewedOn)}).
                    {stale && <span className="new">Review due</span>}
                </p>
            </div>
        </>
    )
}

// ── live facts inside regulation cards ────────────────────────────

function LiveFact({ live, state, constructors, customers }: { live: string; state?: SeasonState; constructors: ConstructorStanding[]; customers: Map<string, Set<string>> }) {
    if (live === 'suppliers' && customers.size) {
        return (
            <div className="reg-live">
                {[...customers].map(([supplier, teams]) => `${supplier}: ${[...teams].join(', ')}`).join(' · ')}
            </div>
        )
    }
    const teamPoints = live.match(/^teamPoints:(.+)$/)?.[1]
    if (teamPoints && state) {
        const standing = constructors.find(c => c.constructor.constructorId === teamPoints)
        if (!standing) return null
        const scored = standing.points > 0
        return (
            <div className="reg-live">
                {scored
                    ? `${formatPoints(standing.points)} points after ${state.asOfRound} rounds — P${standing.position} of ${constructors.length} in the constructors'.`
                    : `Still to score after ${state.asOfRound} rounds — P${standing.position} of ${constructors.length} in the constructors'.`}
            </div>
        )
    }
    return null
}

// ── ADUO periods: races and status from the schedule ──────────────

function PeriodRow({ period, schedule, state }: { period: Period; schedule: ScheduleRace[]; state?: SeasonState }) {
    const from = schedule.find(r => r.circuitId === period.fromCircuit)?.round
    const to = schedule.find(r => r.circuitId === period.toCircuit)?.round
    const races = from && to ? schedule.filter(r => r.round >= from && r.round <= to) : []
    const done = races.filter(r => state && r.round <= state.roundsDone).length
    const status = period.result ? 'Result published' : done === 0 ? 'Upcoming' : done === races.length ? 'Awaiting FIA result' : `In progress · ${done}/${races.length}`
    const tone = period.result ? 'yes' : done > 0 ? 'active' : 'none'
    return (
        <tr>
            <td className="strong">{period.name}</td>
            <td className="muted">
                {races.length ? `R${from}–R${to}: ${races.map(r => circuitCode(r)).join(' · ')}` : '—'}
                {races.length > 0 && <div className="aduo-sub">{shortRaceName(races[0].raceName)} → {shortRaceName(races[races.length - 1].raceName)}</div>}
            </td>
            <td className="muted">{period.result ?? '—'}{period.resultDate && <div className="aduo-sub">Published {formatDay(period.resultDate)}</div>}</td>
            <td className="c"><span className={`aduo-pill ${tone}`}>{status}</span></td>
        </tr>
    )
}

// ── ADUO in the press (from the stored race summaries — no extra cost) ──

// Engine-specific wording only: "homologation" alone also matches track changes
const ADUO_PATTERN = /\bADUO\b|(engine|power unit|PU)\s+(upgrade|homologation)|(extra|additional)\s+(assistance|help|support|upgrades?)\s+for\s+\**(Honda|Audi|Ferrari|Mercedes)/i

function PressMentions({ rounds }: { rounds: Record<string, RoundNews> }) {
    const mentions = Object.entries(rounds)
        .flatMap(([round, news]) => news.bullets
            .filter(b => ADUO_PATTERN.test(b.text))
            .map(b => ({ round: Number(round), text: b.text, source: news.sources.find(s => s.id === b.sources[0]) })))
        .sort((a, b) => b.round - a.round)
        .slice(0, 5)
    if (!mentions.length) return null
    return (
        <div className="reg-card aduo">
            <div className="reg-title">In the press</div>
            <ul className="race-bullet-list">
                {mentions.map((m, i) => (
                    <li key={i}>
                        <span className="text-[#555]">R{m.round} · </span><RichText text={m.text} />
                        {m.source && <a className="press-ref" href={m.source.url} target="_blank" rel="noreferrer" title={m.source.title}>{m.source.site}</a>}
                    </li>
                ))}
            </ul>
        </div>
    )
}
