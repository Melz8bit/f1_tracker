import { useState } from "react";
import { ELEMENTS, ELEMENT_NAMES, LIMITS, type DriverPU, type Element, type PUPenalty } from "../../lib/powerUnits";

interface ComponentUsageProps {
    season: number;
    color: string;
    drivers: DriverPU[]; // This team's drivers, counts as of the selected round
    penalties: Array<PUPenalty & { round: number }>; // This team's PU penalties so far this season
    asOfRound: number;
}

// "R14: −40 grid (5th ICE, 5th TC …)" / "R4: pit-lane start (4th ES, 4th PU-CE)"
function penaltyLabel(p: PUPenalty & { round: number }): string {
    const what = p.pitLane ? 'pit-lane start' : p.gridDrop ? `−${p.gridDrop} grid` : 'penalty'
    const elements = p.elements.map(e => `${e.nth}${ordinal(e.nth)} ${e.element}`).join(', ')
    return `R${p.round}: ${what}${elements ? ` (${elements})` : ''}`
}

const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')

function ElementRow({ element, used, limit, color }: { element: Element; used: number; limit: number; color: string }) {
    const over = used > limit
    const left = Math.max(0, limit - used)
    const usedColor = over ? '#ff4411' : used === limit ? '#cc8800' : color
    const leftColor = over ? '#ff4411' : left === 0 ? '#cc8800' : left === 1 ? '#cc9900' : '#4caf50'
    const pips = Array.from({ length: Math.max(limit, used) }, (_, i) => {
        if (i >= limit) return <div key={i} className="comp-pip comp-pip-over" title="Over the limit — grid penalty" />
        if (i < used) return <div key={i} className="comp-pip" style={{ background: usedColor }} />
        return <div key={i} className={`comp-pip ${left <= 1 ? 'comp-pip-warn' : 'comp-pip-left'}`} />
    })
    return (
        <div className="comp-row">
            <div className="comp-name" title={ELEMENT_NAMES[element]}>{element}</div>
            <div className="comp-used" style={{ color: usedColor }}>{used}</div>
            <div className="comp-alloc">{limit}</div>
            <div className="comp-left" style={{ color: leftColor }}>{over ? `+${used - limit} ⚠️` : left}</div>
            <div className="comp-pips">{pips}</div>
        </div>
    )
}

export default function ComponentUsage({ season, color, drivers, penalties, asOfRound }: ComponentUsageProps) {
    const [open, setOpen] = useState(false)
    const limits = LIMITS[season]
    if (!limits || drivers.length === 0) return null

    return (
        <>
            <div className="comp-toggle" onClick={() => setOpen(o => !o)}>
                <span className="comp-toggle-label">Component usage</span>
                <span className={`comp-toggle-arrow${open ? ' open' : ''}`}>▼</span>
            </div>
            {open && (
                <div className="comp-panel">
                    <div className="comp-note" style={{ borderBottom: '1px solid #1e1e1e' }}>
                        <strong>Season allocation per driver</strong> (FIA 2026 Sporting Regulations B8.2):{' '}
                        {ELEMENTS.map(e => `${e} ${limits[e]}`).join(' · ')}. Using more means a grid penalty — 10 places the
                        first time for each element, 5 for each one after. Counts from the FIA Technical Delegate's reports,
                        after the R{asOfRound} weekend.
                    </div>
                    {drivers.map(d => {
                        const driverPenalties = penalties.filter(p => p.car === d.car)
                        return (
                            <div key={d.car}>
                                <div className="comp-driver">
                                    <span className="comp-driver-name">#{d.car} {d.driver}</span>
                                    {driverPenalties.map(p => (
                                        <a key={p.url} className="comp-penalty" href={p.url} target="_blank" rel="noreferrer" title={p.decision}>
                                            {penaltyLabel(p)}
                                        </a>
                                    ))}
                                </div>
                                <div className="comp-header-row"><span>Element</span><span>Used</span><span>Limit</span><span>Left</span><span>Visual</span></div>
                                {ELEMENTS.map(e => <ElementRow key={e} element={e} used={d.counts[e]} limit={limits[e]} color={color} />)}
                            </div>
                        )
                    })}
                </div>
            )}
        </>
    )
}
