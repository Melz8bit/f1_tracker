// External Imports
import { Fragment, useState } from "react"

// Internal Imports
import { useFilterStore } from "../../store/filterStore"
import { useSeason } from "../../hooks/useSeason"
import { usePoles } from "../../hooks/usePoles"
import { cancelledMeetings, findSession, FIRST_OPENF1_SEASON, useOpenF1Season } from "../../hooks/useOpenF1Sessions"
import { useSessionData } from "../../hooks/useSessionData"
import { pointsSystem } from "../../lib/championship"
import { resultFacts, sessionFacts } from "../../lib/raceFacts"
import { teamColor, teamName } from "../../lib/teams"
import { driverShortName, formatWeekend } from "../../lib/format"
import type { Pole, Race, RaceResult, ScheduleRace } from "../../types/f1"
import type { OpenF1Meeting } from "../../lib/openf1"
import RichText from "../shared/RichText"
import raceNotesJson from "../../data/raceNotes.json"
import raceNewsJson from "../../data/raceNews.json"
import type { NewsFile, RoundNews } from "../../lib/news"

interface SeasonNotes {
    asOfRound: number;
    rounds: Record<string, string[]>;
    cancelled: Record<string, string>;
}
const raceNotes = raceNotesJson as Record<string, SeasonNotes | undefined>
const raceNews = raceNewsJson as NewsFile

type Row =
    | { kind: 'race'; date: string; race: Race; info: ScheduleRace; sprint?: Race; pole?: Pole }
    | { kind: 'cancelled'; date: string; meeting: OpenF1Meeting }

export default function RaceByRaceTab() {
    const { season, state, schedule, races, sprints, isLoading, error } = useSeason()
    const { roundMin } = useFilterStore()
    const { data: poles } = usePoles(season)
    const { meetings } = useOpenF1Season(season)
    // undefined = nothing clicked yet → the latest round starts open
    const [openRound, setOpenRound] = useState<number | null | undefined>(undefined)

    if (isLoading) return <p className="text-sm text-[#666]">Loading races…</p>
    if (error) return <p className="text-sm text-[#ff4422]">Failed to load races.</p>
    if (!state || state.asOfRound === 0) return <p className="text-sm text-[#666]">No races completed yet this season.</p>

    const fromRound = Math.min(roundMin, state.asOfRound)
    const toRound = state.asOfRound
    const rows = buildRows(schedule, races, sprints, poles ?? [], meetings, fromRound, toRound)
    const expanded = openRound === undefined ? toRound : openRound
    const notes = raceNotes[String(season)]

    // "Spain" is ambiguous when a country hosts twice — add the town
    const countryCount = new Map<string, number>()
    for (const r of schedule) countryCount.set(r.country, (countryCount.get(r.country) ?? 0) + 1)
    const gpLabel = (info: ScheduleRace) => (countryCount.get(info.country) ?? 0) > 1 ? `${info.country} (${info.locality})` : info.country

    return (
        <>
            <table className="race-tbl">
                <thead>
                    <tr>
                        <th style={{ width: 28 }}>#</th>
                        <th>Grand Prix</th>
                        <th style={{ width: 95 }}>Pole</th>
                        <th style={{ width: 120 }}>Winner</th>
                        <th>P2 · P3</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => row.kind === 'cancelled'
                        ? <CancelledRow key={`x-${row.meeting.meeting_key}`} meeting={row.meeting} reason={notes?.cancelled[row.meeting.meeting_name]} />
                        : (
                            <RaceRows
                                key={row.race.round}
                                row={row}
                                label={gpLabel(row.info)}
                                isNew={state.isLatest && row.race.round === state.roundsDone}
                                open={expanded === row.race.round}
                                onToggle={() => setOpenRound(expanded === row.race.round ? null : row.race.round)}
                                notes={notes?.rounds[String(row.race.round)]}
                                press={raceNews[String(season)]?.[String(row.race.round)]}
                            />
                        )
                    )}
                </tbody>
            </table>
            {notes && (
                <p className="note">
                    Race facts are generated from Jolpica results and OpenF1 timing data. "From the press" is summarized
                    offline from linked articles, with quotes checked word-for-word against the source; where results
                    and an article disagree, the results win. Rounds without press coverage show hand-written notes
                    (last reviewed after R{notes.asOfRound}).
                </p>
            )}
        </>
    )
}

// Completed rounds in the filter range, plus cancelled meetings that fall between them, in date order
function buildRows(
    schedule: ScheduleRace[], races: Race[], sprints: Race[], poles: Pole[], meetings: OpenF1Meeting[],
    fromRound: number, toRound: number,
): Row[] {
    const rows: Row[] = []
    for (const race of races) {
        if (race.round < fromRound || race.round > toRound || race.results.length === 0) continue
        const info = schedule.find(r => r.round === race.round)
        if (!info) continue
        rows.push({
            kind: 'race',
            date: race.date,
            race,
            info,
            sprint: sprints.find(s => s.round === race.round && s.results.length > 0),
            pole: poles.find(p => p.round === race.round),
        })
    }

    const after = schedule.find(r => r.round === fromRound - 1)?.date ?? ''
    const before = schedule.find(r => r.round === toRound + 1)?.date ?? new Date().toISOString().slice(0, 10)
    for (const meeting of cancelledMeetings(meetings)) {
        const date = meeting.date_end.slice(0, 10)
        if (date > after && date < before) rows.push({ kind: 'cancelled', date, meeting })
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date))
}

function CancelledRow({ meeting, reason }: { meeting: OpenF1Meeting; reason?: string }) {
    const shortReason = reason?.replace(/^Cancelled — /, '')
    return (
        <tr className="race-summary-row cancelled-row">
            <td className="font-semibold">✕</td>
            <td className="font-medium">{meeting.country_name}</td>
            <td className="text-xs">—</td>
            <td className="text-xs font-semibold">CANCELLED</td>
            <td className="text-xs" title={reason}>{shortReason ? shortReason.charAt(0).toUpperCase() + shortReason.slice(1) : '—'}</td>
        </tr>
    )
}

interface RaceRowsProps {
    row: Extract<Row, { kind: 'race' }>;
    label: string;
    isNew: boolean;
    open: boolean;
    onToggle: () => void;
    notes?: string[];
    press?: RoundNews;
}

function RaceRows({ row, label, isNew, open, onToggle, notes, press }: RaceRowsProps) {
    const { race, info, sprint, pole } = row
    const [p1, p2, p3] = [1, 2, 3].map(pos => race.results.find(r => r.position === pos))
    return (
        <Fragment>
            <tr className="race-summary-row" onClick={onToggle}>
                <td className="font-semibold text-[#555]">{race.round}</td>
                <td className="font-medium">
                    {label}
                    {sprint && <span className="race-tag race-tag-sprint">S</span>}
                    {isNew && <span className="race-tag race-tag-new">NEW</span>}
                    <span className={`race-expand-icon${open ? ' open' : ''}`}>▼</span>
                </td>
                <td className="text-xs text-[#777]">{pole?.driver.familyName ?? '—'}</td>
                <td className="font-semibold" style={{ color: p1 ? teamColor(p1.constructor.constructorId) : '#555' }}>{p1?.driver.familyName ?? '—'}</td>
                <td className="text-xs text-[#666]">{[p2, p3].map(r => r?.driver.familyName ?? '—').join(' · ')}</td>
            </tr>
            {open && (
                <tr className="race-detail-row">
                    <td colSpan={5}>
                        <div className="race-detail-body">
                            <div className="race-detail-title">
                                <span>{race.raceName} · {race.circuitName} · {formatWeekend(info)}</span>
                                {sprint && <span className="text-[11px] text-[#cc9900]">Sprint weekend</span>}
                            </div>
                            <RaceFacts race={race} pole={pole} />
                            {press && <PressCoverage press={press} />}
                            {!press && notes && notes.length > 0 && (
                                <>
                                    <div className="res-section-label">Notes<span className="res-section-hint">hand-written</span></div>
                                    <ul className="race-bullet-list">{notes.map((n, i) => <li key={i}><RichText text={n} /></li>)}</ul>
                                </>
                            )}
                            {sprint && <ResultsTable results={sprint.results} label="🏃 Sprint Race Results" season={race.season} isSprint />}
                            <ResultsTable results={race.results} label="🏁 Grand Prix Results" season={race.season} />
                        </div>
                    </td>
                </tr>
            )}
        </Fragment>
    )
}

// Rendered only for the open row, so OpenF1 is queried on demand
function RaceFacts({ race, pole }: { race: Race; pole?: Pole }) {
    const { meetings, sessions } = useOpenF1Season(race.season)
    const session = findSession(meetings, sessions, race.date, 'Race')
    const { data, isLoading } = useSessionData(session?.session_key)

    const facts = [...resultFacts(race, pole), ...(data ? sessionFacts(race, data) : [])]
    const waitingOnOpenF1 = race.season >= FIRST_OPENF1_SEASON && (isLoading || (!session && meetings.length === 0))
    return (
        <>
            <div className="res-section-label">
                Race facts{waitingOnOpenF1 && <span className="res-section-hint">loading timing data…</span>}
            </div>
            <ul className="race-bullet-list">{facts.map((f, i) => <li key={i}><RichText text={f} /></li>)}</ul>
        </>
    )
}

// ── Press coverage ────────────────────────────────────────────────

function PressCoverage({ press }: { press: RoundNews }) {
    const byId = new Map(press.sources.map(src => [src.id, src]))
    const Refs = ({ ids }: { ids: number[] }) => (
        <>
            {ids.map(id => {
                const src = byId.get(id)
                return src && (
                    <a key={id} className="press-ref" href={src.url} target="_blank" rel="noreferrer" title={`${src.site}: ${src.title}`}>[{id}]</a>
                )
            })}
        </>
    )
    return (
        <>
            <div className="res-section-label">
                From the press<span className="res-section-hint">summarized from {press.sources.length} articles</span>
            </div>
            {press.headline && <p className="press-headline">{press.headline}</p>}
            <ul className="race-bullet-list">
                {press.bullets.map((b, i) => <li key={i}><RichText text={b.text} /><Refs ids={b.sources} /></li>)}
            </ul>
            {press.quotes.map((q, i) => (
                <div key={i} className="press-quote">
                    "{q.quote}"<span className="who">— {q.speaker}</span><Refs ids={[q.source]} />
                </div>
            ))}
            <div className="press-sources">
                {press.sources.map(src => (
                    <div key={src.id}>
                        [{src.id}] <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> · {src.site} · {src.published}
                    </div>
                ))}
                {press.links.length > 0 && (
                    <div className="mt-1">
                        More coverage: {press.links.map((l, i) => (
                            <span key={l.url}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noreferrer">{l.title}</a> ({l.site})</span>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}

// ── Results tables ────────────────────────────────────────────────

function positionLabel(r: RaceResult): string {
    switch (r.positionText) {
        case 'R': return 'DNF'
        case 'W': return 'DNS'
        case 'D': return 'DSQ'
        case 'N': return 'NC'
        default: return String(r.position)
    }
}

const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32']

function Delta({ r }: { r: RaceResult }) {
    const classified = /^\d+$/.test(r.positionText)
    if (!classified) return <td className="delta-eq">{positionLabel(r)}</td>
    if (r.grid === 0) return <td className="delta-eq">PIT</td>
    const delta = r.grid - r.position
    if (delta > 0) return <td className="delta-up">+{delta}</td>
    if (delta < 0) return <td className="delta-dn">{delta}</td>
    return <td className="delta-eq">—</td>
}

interface ResultsTableProps {
    results: RaceResult[];
    label: string;
    season: number;
    isSprint?: boolean;
}

function ResultsTable({ results, label, season, isSprint }: ResultsTableProps) {
    const scoring = isSprint ? pointsSystem(season).sprint.length : pointsSystem(season).race.length
    return (
        <>
            <div className="res-section-label">{label}<span className="res-section-hint">top {scoring} score</span></div>
            <table className="res-tbl">
                <thead>
                    <tr>
                        <th style={{ width: 32 }}>Pos</th>
                        <th>Driver</th>
                        <th className="rc" style={{ width: 36 }}>Grid</th>
                        <th className="rc" style={{ width: 36 }}>Δ</th>
                        <th className="rr" style={{ width: 32 }}>Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map(r => {
                        const classified = /^\d+$/.test(r.positionText)
                        const color = teamColor(r.constructor.constructorId)
                        return (
                            <tr key={r.driver.driverId} className={classified ? '' : 'dnf-row'}>
                                <td className="res-pos" style={{ color: classified ? MEDAL[r.position - 1] ?? '#aaa' : '#aaa' }}>{positionLabel(r)}</td>
                                <td>
                                    <div className="res-driver">{driverShortName(r.driver)}</div>
                                    <div className="res-team"><span className="pip" style={{ background: color, width: 6, height: 6 }} />{teamName(r.constructor)}</div>
                                </td>
                                <td className="res-grid">{r.grid === 0 ? 'PIT' : r.grid}</td>
                                <Delta r={r} />
                                <td className="res-pts">
                                    {r.points > 0 ? <span style={{ color }}>{r.points}</span> : <span className="text-[#333]">0</span>}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </>
    )
}
