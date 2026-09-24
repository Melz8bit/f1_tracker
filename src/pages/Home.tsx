import { useState } from "react";
import StandingsTab from "../components/dashboard/StandingsTab";
import RaceByRaceTab from "../components/dashboard/RaceByRaceTab";
import PaceProfileTab from "../components/dashboard/PaceProfileTab";
import FormGuideTab from "../components/dashboard/FormGuideTab";
import RegChangesTab from "../components/dashboard/RegChangesTab";
import DriverContractsTab from "../components/dashboard/DriverContractsTab";
import RangeFilter from "../components/dashboard/RangeFilter";
import { useSeason } from "../hooks/useSeason";
import { formatDay, shortRaceName } from "../lib/format";

const TABS = [
    { id: 'standings', label: 'Standings' },
    { id: 'pace', label: 'Team Pace Profiles' },
    { id: 'races', label: 'Race by Race' },
    { id: 'regs', label: 'Reg Changes' },
    { id: 'form', label: 'Form Guide' },
    { id: 'contracts', label: 'Driver Contracts' },
] as const

type TabId = typeof TABS[number]['id']

// Tab lives in the URL hash so a refresh or shared link keeps it
function initialTab(): TabId {
    const hash = window.location.hash.slice(1)
    return TABS.some(t => t.id === hash) ? hash as TabId : 'standings'
}

export default function Home() {
    const [tab, setTab] = useState<TabId>(initialTab)
    const { season, state } = useSeason()

    const selectTab = (id: TabId) => {
        setTab(id)
        window.history.replaceState(null, '', `#${id}`)
    }

    const latest = state?.latest
    const badge = latest
        ? `${state.isLatest ? 'Updated' : 'Viewing'} · R${latest.round} ${shortRaceName(latest.raceName)} · ${formatDay(latest.date)}`
        : 'Season not started'

    return (
        <div>
            <div className="header">
                <h1>🏎 F1 {season} Season Dashboard</h1>
                {state && <span className="updated">{badge}</span>}
            </div>

            <div className="tab-row">
                {TABS.map(t => (
                    <button key={t.id} className={`tb${tab === t.id ? ' on' : ''}`} onClick={() => selectTab(t.id)}>
                        {t.id === 'regs' ? `${season} ${t.label}` : t.label}
                    </button>
                ))}
            </div>

            <RangeFilter />

            {tab === 'standings' && <StandingsTab />}
            {tab === 'pace' && <PaceProfileTab />}
            {tab === 'races' && <RaceByRaceTab />}
            {tab === 'regs' && <RegChangesTab />}
            {tab === 'form' && <FormGuideTab />}
            {tab === 'contracts' && <DriverContractsTab />}
        </div>
    )
}
